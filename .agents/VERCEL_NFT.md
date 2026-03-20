# @vercel/nft — Deep Reference

> Node File Trace — static analysis tool that determines exactly which files a Node.js application needs at runtime. Used by Vercel, Nitro, and nf3 as the core tracing engine.

## Public API

### `nodeFileTrace(files, opts)`

```ts
async function nodeFileTrace(
  files: string[],
  opts?: NodeFileTraceOptions,
): Promise<NodeFileTraceResult>
```

**Result:**

```ts
{
  fileList: Set<string>          // All traced files (relative to base)
  esmFileList: Set<string>       // Subset that are ESM modules
  reasons: Map<string, {         // Why each file was included
    type: ('initial' | 'resolve' | 'dependency' | 'asset' | 'sharedlib')[]
    ignored: boolean
    parents: Set<string>
  }>
  warnings: Set<Error>           // Parse/resolution warnings
}
```

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `base` | `string` | `process.cwd()` | Base directory for relative paths |
| `processCwd` | `string` | — | Working directory for processing |
| `conditions` | `string[]` | `['node']` | Export conditions to resolve |
| `exports` | `string[]` | — | Fallback for `conditions` |
| `exportsOnly` | `boolean` | `false` | Only use `exports` field, skip legacy resolution |
| `ignore` | `string \| string[] \| Function` | — | Paths/patterns/function to exclude |
| `analysis` | `boolean \| object` | `true` | AST analysis config (see below) |
| `cache` | `object` | — | Reusable cache (fileCache, statCache, symlinkCache, analysisCache) |
| `paths` | `Record<string, string>` | — | TypeScript path mappings |
| `ts` | `boolean` | `true` | Enable `.ts`/`.tsx` resolution |
| `log` | `boolean` | `false` | Debug logging |
| `mixedModules` | `boolean` | — | Allow CJS+ESM in same file |
| `readFile` | `Function` | — | Custom file reader |
| `stat` | `Function` | — | Custom stat function |
| `readlink` | `Function` | — | Custom readlink function |
| `resolve` | `Function` | — | Custom resolver hook |
| `fileIOConcurrency` | `number` | `1024` | Max concurrent file operations |
| `depth` | `number` | `Infinity` | Max recursion depth |

**Analysis sub-options** (`analysis: { ... }`):

- `emitGlobs` — track dynamic requires with wildcards
- `computeFileReferences` — resolve `__dirname`, `__filename`, `import.meta.url`
- `evaluatePureExpressions` — evaluate statically-known bindings

## Architecture

### Core Flow

```
nodeFileTrace(entry files)
  → Job.emitDependency(file)           # only once per file (tracked via processed Set)
    → analyze(file content)            # AST parsing + static evaluation (Acorn)
      ├─ Extract: deps, imports, assets, isESM
      └─ Return: cached AnalyzeResult
    → For each dep/import:
      → maybeEmitDep() → resolveDependency()
        ├─ Package resolution (exports, main, node_modules walk)
        ├─ Path resolution (relative, .ts/.tsx/.js/.json/.node)
        └─ Returns: resolved path(s)
      → Job.emitDependency() recursively
```

### Key Modules

| File | Role |
|---|---|
| `src/node-file-trace.ts` | `Job` class, `nodeFileTrace()`, orchestration |
| `src/analyze.ts` | AST analysis, dependency extraction (~1200 LOC) |
| `src/resolve-dependency.ts` | Module resolution (CJS/ESM/exports/imports) |
| `src/fs.ts` | `CachedFileSystem` — async I/O with concurrency control |
| `src/utils/static-eval.ts` | Expression evaluator with conditional branch support |
| `src/utils/special-cases.ts` | Package-specific custom logic (~400+ LOC) |
| `src/utils/sharedlib-emit.ts` | Native shared library discovery |
| `src/utils/binary-locators.ts` | node-pre-gyp / nbind resolution |
| `src/utils/wrappers.ts` | UglifyJS/Webpack wrapper detection |
| `src/utils/get-package-base.ts` | Package name extraction from paths |

### `Job` Class (Orchestrator)

Core state:

- `fileList` / `esmFileList` — traced file sets
- `reasons` — dependency graph with parent tracking
- `analysisCache` — per-file AST analysis results (keyed by realpath)
- `processed: Set` — prevents re-analyzing same file (handles circular deps)
- `CachedFileSystem` — file I/O with `async-sema` concurrency limiting

Key methods: `emitFile()`, `emitDependency()`, `maybeEmitDep()`, `realpath()`, `getPjsonBoundary()`

## Resolution Logic

### `resolveDependency(specifier, parent, job, cjsResolve)`

1. **Detect specifier type:**
   - Absolute / relative (`./`, `../`) → `resolvePath()`
   - Starts with `#` → `packageImportsResolve()` (package `imports` field)
   - Else → `resolvePackage()` (node_modules walk)

2. **`resolvePath(path)`** — relative imports:
   - Try `resolveFile(path)` → check existence
   - Try `resolveDir(path)` → check `package.json` main + index files
   - TS support: try `.ts` / `.tsx` extensions if not in `node_modules`
   - Extensions tried: `.ts`, `.tsx`, `.js`, `.json`, `.node`

3. **`resolvePackage(name)`** — bare specifiers:
   - Check if Node.js built-in (`node:*`)
   - Check **self-resolution** (package's own `exports`)
   - Walk up directories looking for `node_modules/{pkgName}`
   - Apply **exports conditions** via `resolveExportsImports()`
   - Fallback to legacy path resolution (if `!exportsOnly`)
   - Check tsconfig/jsconfig path mappings

### Package.json `exports` / `imports` Resolution

**`resolveExportsImports(pkgPath, obj, subpath, isImports, cjsResolve)`:**

1. Normalize: wrap non-object exports in `{ '.': value }`
2. Exact match: `subpath in matchObj`
3. Wildcard match: sort keys by length (longest first), match `*` patterns
4. Directory match: trailing `/` keys
5. Get target: `getExportsTarget(value, conditions, cjsResolve)`

**Condition selection order:** `'default'`, `'require'`/`'import'` (based on cjsResolve), custom conditions. Node 22+: also checks `'module-sync'`.

## AST Analysis

### Parser

- **Acorn** with ESTree support + `acorn-import-attributes` plugin
- Try CJS parse first → if fails, try ESM (`sourceType: 'module'`)
- Strips shebang before parsing

### Dependency Extraction

1. **ES imports/exports** — `ImportDeclaration`, `ExportNamedDeclaration`, `ExportAllDeclaration`
2. **CommonJS** — `require(specifier)`, `require.resolve()`
3. **Dynamic imports** — `import(expr)` expressions
4. **Asset detection** — `__dirname`/`__filename`/`import.meta.url` used in path context → emit glob

### Static Evaluation (`static-eval.ts`)

- Visitor pattern over AST
- Evaluates to `{ value }` or `{ test, ifTrue, else }` (conditional) or `undefined`
- Wildcards: unknown string parts marked with `\x1a` (WILDCARD char)
- Handles operators, array/object literals, function calls
- Respects variable scope via `knownBindings` map

### Special Symbol Bindings

The analyzer recognizes patterns and assigns symbols for special handling:

| Symbol | Pattern | Action |
|---|---|---|
| `BINDINGS` | `require('bindings')(opts)` | Resolve native `.node` binding |
| `NODE_GYP_BUILD` | `require('node-gyp-build')(dir)` | Find prebuilt binary |
| `NBIND_INIT` | `nbind.init(...)` | Find `.node` file |
| `EXPRESS_SET` | `app.set('view engine', name)` | Require view engine |
| `PINO_TRANSPORT` | `pino.transport({ target })` | Extract transport targets |
| `FS_FN` / `FS_DIR_FN` | `fs.readFile()` etc. | Emit file/directory assets |
| `BOUND_REQUIRE` | Wrapper functions | Track require through wrappers |

## Caching

### Three-Layer Cache

1. **File I/O Cache** (`CachedFileSystem`):
   - `fileCache: Map<path, Promise<content>>`
   - `statCache: Map<path, Promise<Stats>>`
   - `symlinkCache: Map<path, Promise<link>>`
   - Promises stored immediately → concurrent dedup

2. **Analysis Cache** (`Job.analysisCache`):
   - `Map<realPath, { assets, deps, imports, isESM }>`
   - Keyed by realpath (symlinks resolved)

3. **Processed Set** (`Job.processed`):
   - `Set<realPath>` — prevents re-analysis (handles cycles)

All caches can be passed in via `opts.cache` for reuse across multiple `nodeFileTrace()` calls.

## Wildcard / Dynamic Requires

When `require(expr)` contains unknowns:

1. Static analyzer marks unknown parts with WILDCARD char (`\x1a`)
2. Glob pattern generated from the string
3. Matching files emitted as dependencies
4. Filters applied: exclude `.h`, `.cmake`, `.c`, `.cpp`, `README.md`, `CHANGELOG.md`

Example: `require(variable + '.js')` → `'\x1a.js'` → glob `**/*.js`

## Special Package Handling

Packages with custom logic in `special-cases.ts`:

- **esbuild, sharp** — complex optional dependency binary emission
- **oracledb, phantomjs-prebuilt** — binary path resolution
- **firebase, google-gax** — AST-based proto/config extraction
- **socket.io, bull** — dynamic require patterns
- **camaro** — WASM file emission
- **@serialport/bindings-cpp, argon2** — custom binary locations

### Native Binding Resolution

After emitting a `.node` file, scans package base for shared libraries:
- macOS: `**/*.dylib`, `**/*.so*`
- Windows: `**/*.dll`
- Linux: `**/*.so*`

## Limitations

1. **Truly dynamic requires** — `require(getUserInput())` cannot be traced
2. **Missing default condition** — if `conditions` don't match and no `'default'`, resolution fails
3. **No workspace awareness** — no special handling for yarn/pnpm workspaces
4. **Object shorthand exports** — `module.exports = { foo: require('bar') }` — `foo` binding not tracked
5. **Cyclic dependencies** — handled via `processed` set (only first encounter traced)

## CLI

```bash
nft print <file>   # Print traced files
nft build <file>   # Copy traced files to output
nft size <file>    # Show total size of traced files
nft why <file>     # Show why a file was included (parent chain)
```

## How nf3 Uses @vercel/nft

nf3 calls `nodeFileTrace()` from `src/trace.ts`, then:

1. Filters results to `node_modules` files only
2. Parses package name/version from paths
3. Handles `fullTraceInclude` (glob entire packages)
4. Deduplicates by package name + version
5. Single-version → copy to `dist/node_modules/{name}/`
6. Multi-version → `.nf3/{name}@{version}` + symlinks
7. Applies transforms, production export conditions, chmod
