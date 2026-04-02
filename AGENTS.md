# nf3

Node File Trace 3 — traces and copies only runtime-required `node_modules` into build output. Powered by [`@vercel/nft`](https://github.com/vercel/nft), originally extracted from [Nitro](https://nitro.build).

**Problem:** Bundling external dependencies can fail due to relative paths, native bindings, or dynamic imports. nf3 analyzes build output, traces runtime dependencies, and copies a tree-shaken, deduplicated, runtime-only subset of `node_modules`.

## Project Structure

```
src/
  index.ts        # Main entry — re-exports traceNodeModules, NodeNativePackages, types
  trace.ts        # Core tracing logic (traceNodeModules function)
  plugin.ts       # Rollup/Rolldown/Vite plugin ("externals")
  types.ts        # All type definitions
  db.ts           # Lists of native/non-bundleable packages
  _utils.ts       # Internal helpers (parseNodeModulePath, guessSubpath, etc.)
test/
  trace.test.ts      # Tests for traceNodeModules
  plugin.test.ts     # Tests for rollup/rolldown plugin
  condition.test.ts  # Tests for applyProductionCondition
  fixture/           # Multi-version package fixtures
```

**Three entry points** exported via `package.json`:

- `.` → `dist/index.mjs` — main `traceNodeModules` API
- `./db` → `dist/db.mjs` — `NodeNativePackages` / `NonBundleablePackages` arrays
- `./plugin` → `dist/plugin.mjs` — bundler plugin

## Architecture

### Core Flow

```
Build files → Plugin externalizes modules → Bundler writes output
  → traceNodeModules() → @vercel/nft traces dependencies
  → Parse & categorize by package → Deduplicate versions
  → Copy to dist/node_modules/ (single-version: direct, multi-version: .nf3/ + symlinks)
  → Apply transforms, production exports, chmod
```

### `traceNodeModules(input, opts)` — `src/trace.ts`

Main function. Steps:

1. Call `@vercel/nft` `nodeFileTrace()` to identify all used files
2. Filter to `node_modules` files only
3. Parse package name/version from paths via `parseNodeModulePath()`
4. Handle `fullTraceInclude` — glob all files in specified packages
5. Deduplicate — group by package name and version
6. Single-version packages → copy to `dist/node_modules/{name}/`
7. Multi-version packages → copy to `.nf3/{name}@{version}`, symlink from parent packages' `node_modules/`
8. Apply transforms, production export conditions, write package.json

Key internal functions: `writePackage()`, `linkPackage()`, `findPackageParents()`, `applyProductionCondition()`, `compareVersions()`

### Plugin — `src/plugin.ts`

Rollup/Rolldown/Vite plugin named `externals`:

- `resolveId` hook intercepts imports, filters via include/exclude patterns
- Marks matching packages as `external: true`
- Collects externalized paths in `tracedPaths` Set
- `writeBundle` hook calls `traceNodeModules()` with collected paths
- Normalizes Node.js built-ins to `node:*` prefix

### Types — `src/types.ts`

Key interfaces:

- `ExternalsPluginOptions` — plugin config (rootDir, include, exclude, trace, traceInclude, conditions)
- `ExternalsTraceOptions` — tracing config (rootDir, outDir, nft, conditions, traceAlias, chmod, writePackageJson, fullTraceInclude, hooks, transform)
- `TracedFile` — individual traced file info (path, subpath, parents, pkgPath, pkgName, pkgVersion)
- `TracedPackage` — package with versions map containing pkgJSON, path, files
- `TraceHooks` — extension points (traceStart, traceResult, tracedFiles, tracedPackages)
- `Transformer` — file transform with filter + handler

### Database — `src/db.ts`

Two arrays:

- `NodeNativePackages` — packages with native bindings (sharp, bcrypt, better-sqlite3, esbuild...)
- `NonBundleablePackages` — packages with bundler incompatibilities (prisma, dd-trace, playwright...)

## Development

```bash
eval "$(fnm env --use-on-cd 2>/dev/null)"  # Enable node/corepack/pnpm
pnpm install                                 # Install deps
pnpm vitest run test/<file>                  # Run specific test
pnpm vitest dev                              # Interactive test mode
pnpm build                                   # Build with obuild
pnpm fmt                                # Format with oxfmt + oxlint
```

**Build:** Uses `obuild` (Rolldown-based). Config in `build.config.ts` — bundles three entry points, traces own dependencies, minifies them with `oxc-minify`.

**Testing:** Vitest with fixtures in `test/fixture/`. Fixtures include multi-version scoped packages for testing dedup/symlink logic.

**Release:** `changelogen` for changelog + versioned git tags.

**Linting:** `oxlint` + `oxfmt` (Rust-based).

## References

- [`.agents/VERCEL_NFT.md`](.agents/VERCEL_NFT.md) — Deep reference for `@vercel/nft` internals (API, resolution logic, AST analysis, caching, special cases)
