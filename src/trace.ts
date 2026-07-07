import * as fsp from "node:fs/promises";
import nft from "@vercel/nft";
import { dirname, isAbsolute, join, normalize, relative, resolve } from "pathe";
import semver from "semver";
import { resolveModulePath } from "exsolve";
import {
  isWindows,
  parseNodeModulePath,
  readJSON,
  resolvePackageDir,
  writeJSON,
} from "./_utils.ts";

import type { NodeFileTraceOptions } from "@vercel/nft";
import type { PackageJson } from "pkg-types";
import type { ExternalsTraceOptions, TracedFile, TracedPackage } from "./types.ts";
export type { ExternalsTraceOptions } from "./types.ts";

// Use the CJS default (whole `module.exports`) rather than a named import.
// `@vercel/nft` is CommonJS and gets minified when bundled into dist; a named
// `import { nodeFileTrace }` relies on Node's cjs-module-lexer detecting the
// export from minified text, which fails on older Node versions (see #52).
const { nodeFileTrace } = nft;

export const DEFAULT_CONDITIONS = ["node", "import", "default"];

const JS_FILE_RE = /\.(?:c|m)?js$/;

export async function traceNodeModules(input: string[], opts: ExternalsTraceOptions) {
  const rootDir = resolve(opts.rootDir || ".");

  // Absolute `traceInclude` entries are traced directly. Bare package names are
  // resolved later against the traced package roots (see below) to avoid
  // resolving against the potentially large `input` file list.
  const allInput = [...input, ...(opts.traceInclude || []).filter((n) => isAbsolute(n))];

  await opts?.hooks?.traceStart?.(allInput);

  const base = opts.nft?.base || "/";

  // Shared nft options so the primary trace and the follow-up transitive trace
  // (for force-included packages, below) resolve modules identically.
  const nftOptions: NodeFileTraceOptions = {
    base: "/",
    exportsOnly: true,
    processCwd: rootDir,
    // https://github.com/nitrojs/nitro/pull/1562
    conditions: (opts.conditions || DEFAULT_CONDITIONS).filter(
      (c) => !["require", "import", "default"].includes(c),
    ),
    ...opts.nft,
  };

  // Trace used files using nft
  const traceResult = await nodeFileTrace([...allInput], nftOptions);

  await opts?.hooks?.traceResult?.(traceResult);

  // Resolve traced files
  const tracedFiles = await resolveTracedFiles(traceResult, base);

  await opts?.hooks?.tracedFiles?.(tracedFiles);

  // Resolve traced packages
  const tracedPackages: Record<string, TracedPackage> = {};
  const pkgCache: Map<string, PackageJson> = new Map();
  // Every file already assigned to a package, so the follow-up transitive trace
  // for force-included packages (below) does not re-add duplicates.
  const seenFiles = new Set<string>();
  await indexTracedFiles(Object.values(tracedFiles), {
    tracedFiles,
    tracedPackages,
    pkgCache,
    seenFiles,
    fullTraceInclude: opts.fullTraceInclude,
  });

  // JS files of force-included packages, traced transitively below so their
  // runtime dependencies get copied too.
  const transitiveInput: string[] = [];

  // Force-trace explicitly requested packages (`traceInclude`) that may not be
  // statically reachable (e.g. native deps loaded dynamically). Each name is
  // resolved from the roots of traced packages that declare it as a dependency,
  // falling back to `rootDir` for app-level deps no traced package declares.
  // Driving this off declared dependencies (instead of trying every name against
  // every root) keeps it cheap even when a large allowlist is passed.
  // https://github.com/unjs/nf3/issues/49
  const traceIncludeSet = new Set((opts.traceInclude || []).filter((n) => !isAbsolute(n)));
  if (traceIncludeSet.size > 0) {
    // Collect the roots of traced packages that declare each requested name.
    const declarerRoots = new Map<string, Set<string>>(
      [...traceIncludeSet].map((name) => [name, new Set<string>()]),
    );
    for (const tracedPackage of Object.values(tracedPackages)) {
      for (const versionEntry of Object.values(tracedPackage.versions)) {
        const deps = {
          ...versionEntry.pkgJSON.dependencies,
          ...versionEntry.pkgJSON.peerDependencies,
          ...versionEntry.pkgJSON.optionalDependencies,
        };
        for (const depName of Object.keys(deps)) {
          declarerRoots.get(depName)?.add(versionEntry.path);
        }
      }
    }
    for (const [name, roots] of declarerRoots) {
      if (tracedPackages[name]) {
        continue;
      }
      // Resolve from a declaring package's root first so we pick the instance the
      // dependent actually uses (correct version, and pnpm's non-hoisted nested
      // location). `rootDir` is only a fallback — otherwise an unrelated copy
      // hoisted at the root could shadow the dependent's real dependency.
      let resolved: string | undefined;
      for (const from of [...roots, rootDir]) {
        // Resolve the bare name (then derive the package root below). Resolving
        // `<name>/package.json` directly is unreliable since a package's
        // `exports` map usually does not expose it.
        resolved =
          resolveModulePath(name, { try: true, from, conditions: opts.conditions }) ||
          resolveModulePath(name + "/package.json", { try: true, from });
        if (resolved) {
          break;
        }
      }
      if (!resolved) {
        continue;
      }
      const { dir, name: resolvedName } = parseNodeModulePath(resolved);
      if (!dir || !resolvedName) {
        continue;
      }
      const depPath = join(dir, resolvedName);
      const depPkgJSON = await readJSON(join(depPath, "package.json")).catch(() => null);
      if (!depPkgJSON) {
        continue;
      }
      const depVersion = depPkgJSON.version || "0.0.0";
      // Full-trace copy all files (native deps load binaries dynamically, so an
      // nft trace would miss them). Added before the optionalDependencies pass
      // below so platform-specific bindings are picked up too.
      const files = await listPkgFiles(depPath);
      tracedPackages[name] = {
        name,
        versions: {
          [depVersion]: {
            path: depPath,
            files,
            pkgJSON: depPkgJSON,
          },
        },
      };
      // The package's own files are copied wholesale, but nft never followed
      // their imports — so queue the JS files for a transitive trace (below) to
      // pull in runtime deps (e.g. `meriyah` for orchestrion). Mark them seen so
      // that trace doesn't re-add them.
      for (const file of files) {
        seenFiles.add(file);
        if (JS_FILE_RE.test(file)) {
          transitiveInput.push(file);
        }
      }
    }
  }

  // Follow transitive dependencies of force-included packages. Runs before the
  // optionalDependencies pass so newly discovered packages get their optional
  // (native) deps auto-included too. https://github.com/nodejs/orchestrion-js/issues/80
  if (transitiveInput.length > 0) {
    const transitiveResult = await nodeFileTrace(transitiveInput, nftOptions);
    const transitiveFiles = await resolveTracedFiles(transitiveResult, base);
    await indexTracedFiles(Object.values(transitiveFiles), {
      tracedFiles,
      tracedPackages,
      pkgCache,
      seenFiles,
      fullTraceInclude: opts.fullTraceInclude,
    });
  }

  // Auto-detect and full-trace optionalDependencies (e.g. platform-specific native bindings)
  for (const tracedPackage of Object.values(tracedPackages)) {
    for (const versionEntry of Object.values(tracedPackage.versions)) {
      const optionalDeps = versionEntry.pkgJSON.optionalDependencies;
      if (!optionalDeps) {
        continue;
      }
      for (const depName of Object.keys(optionalDeps)) {
        if (tracedPackages[depName]) {
          continue;
        }
        // Resolve the optional dep from the parent package's location.
        // Resolving `<dep>/package.json` through the module resolver fails for
        // packages that ship a restrictive `exports` map omitting `./package.json`
        // (e.g. `@img/sharp-libvips-*`, required at runtime via `@rpath` links in
        // sharp's native addon). When the resolver fails, fall back to locating the
        // package directory on disk so the dep is still copied into the output.
        const resolved = resolveModulePath(depName + "/package.json", {
          try: true,
          from: versionEntry.path,
        });
        const depPath = resolved
          ? dirname(resolved)
          : await resolvePackageDir(depName, versionEntry.path);
        if (!depPath) {
          continue;
        }
        const depPkgJSON = await readJSON(join(depPath, "package.json")).catch(() => null);
        if (!depPkgJSON) {
          continue;
        }
        const depVersion = depPkgJSON.version || "0.0.0";
        // Full-trace copy all files from this package
        const files = await listPkgFiles(depPath);
        tracedPackages[depName] = {
          name: depName,
          versions: {
            [depVersion]: {
              path: depPath,
              files,
              pkgJSON: depPkgJSON,
            },
          },
        };
      }
    }
  }

  // Auto-include .node binary files for packages that use dynamic native loading
  // (node-gyp-build, bindings, prebuild-install, node-pre-gyp)
  // Matches node-gyp-build, node-gyp-build-optional-packages, bindings,
  // prebuild-install, node-pre-gyp (and scoped forks like @mapbox/node-pre-gyp)
  const nativeLoaderRE =
    /(?:^|\/)(node-gyp-build(?:-optional-packages)?|bindings|prebuild-install|node-pre-gyp)$/;
  for (const tracedPackage of Object.values(tracedPackages)) {
    for (const versionEntry of Object.values(tracedPackage.versions)) {
      const deps = {
        ...versionEntry.pkgJSON.dependencies,
        ...versionEntry.pkgJSON.devDependencies,
      };
      const hasNativeLoader = Object.keys(deps).some((d) => nativeLoaderRE.test(d));
      if (!hasNativeLoader && !versionEntry.pkgJSON.gypfile) {
        const install = versionEntry.pkgJSON.scripts?.install;
        if (!install || !/node-gyp|pre-gyp|prebuild|napi/.test(install)) {
          continue;
        }
      }
      // Glob for .node files and prebuilds that weren't statically traced
      if (fsp.glob) {
        for await (const file of fsp.glob("**/*.node", {
          cwd: versionEntry.path,
          exclude: (name) => name === "node_modules",
        })) {
          const fullPath = join(versionEntry.path, file);
          if (!versionEntry.files.includes(fullPath) && (await isFile(fullPath))) {
            versionEntry.files.push(fullPath);
          }
        }
      }
    }
  }

  await opts?.hooks?.tracedPackages?.(tracedPackages);

  const usedAliases: Record<string, string> = {};

  const outDir = resolve(rootDir, opts.outDir || "dist", "node_modules");

  const writePackage = async (name: string, version: string, _pkgPath?: string) => {
    // Find pkg
    const pkg = tracedPackages[name]!;
    const pkgPath = _pkgPath || pkg.name;

    // Copy files
    for (const src of pkg.versions[version]!.files) {
      const { subpath } = parseNodeModulePath(src);
      if (!subpath) {
        continue;
      }
      const dst = resolve(outDir, pkgPath, subpath);
      await fsp.mkdir(dirname(dst), { recursive: true });

      const transformers = (opts.transform || []).filter((t) => t?.filter?.(src) && t.handler);
      if (transformers.length > 0) {
        let content = await fsp.readFile(src, "utf8");
        for (const transformer of transformers) {
          content = (await transformer.handler(content, src)) ?? content;
        }
        await fsp.writeFile(dst, content, "utf8");
      } else {
        await fsp.copyFile(src, dst);
      }
      if (opts.chmod) {
        await fsp.chmod(dst, opts.chmod === true ? 0o644 : opts.chmod);
      }
    }

    // Copy package.json (clone to avoid mutating the cached original)
    const pkgJSON = pkg.versions[version]!.pkgJSON;
    if (pkgJSON.exports) {
      pkgJSON.exports = JSON.parse(JSON.stringify(pkgJSON.exports));
      applyProductionCondition(pkgJSON.exports);
    }
    const pkgJSONPath = join(outDir, pkgPath, "package.json");
    await fsp.mkdir(dirname(pkgJSONPath), { recursive: true });
    await fsp.writeFile(pkgJSONPath, JSON.stringify(pkgJSON, null, 2), "utf8");

    // Link aliases
    if (opts.traceAlias && opts.traceAlias[pkgPath]) {
      usedAliases[opts.traceAlias[pkgPath]] = version;
      await linkPackage(pkgPath, opts.traceAlias[pkgPath]);
    }
  };

  const linkPackage = async (from: string, to: string) => {
    const src = join(outDir, from);
    const dst = join(outDir, to);
    const dstStat = await fsp.lstat(dst).catch(() => null);
    const exists = dstStat?.isSymbolicLink();
    // console.log("Linking", from, "to", to, exists ? "!!!!" : "");
    if (exists) {
      return;
    }
    await fsp.mkdir(dirname(dst), { recursive: true });
    await fsp
      .symlink(relative(dirname(dst), src), dst, isWindows ? "junction" : "dir")
      .catch((error) => {
        if (error.code !== "EEXIST") {
          console.error("Cannot link", from, "to", to, error);
        }
      });
  };

  // Utility to find package parents
  const findPackageParents = (pkg: TracedPackage, version: string) => {
    // Try to find parent packages
    const versionFiles = pkg.versions[version]!.files.map((path) => tracedFiles[path]).filter(
      (x): x is TracedFile => x !== undefined,
    );
    const parentPkgs = [
      ...new Set(
        versionFiles.flatMap((file) =>
          file.parents
            .map((parentPath) => {
              const parentFile = tracedFiles[parentPath];
              if (!parentFile || parentFile!.pkgName === pkg.name) {
                return null;
              }
              return `${parentFile!.pkgName}@${parentFile!.pkgVersion}`;
            })
            .filter(Boolean),
        ) as string[],
      ),
    ];
    return parentPkgs;
  };

  // Analyze dependency tree
  const multiVersionPkgs: Record<string, { [version: string]: string[] }> = {};
  const singleVersionPackages: string[] = [];
  for (const tracedPackage of Object.values(tracedPackages)) {
    const versions = Object.keys(tracedPackage.versions);
    if (versions.length === 1) {
      singleVersionPackages.push(tracedPackage.name);
      continue;
    }
    multiVersionPkgs[tracedPackage.name] = {};
    for (const version of versions) {
      multiVersionPkgs[tracedPackage.name]![version] = findPackageParents(tracedPackage, version);
    }
  }

  // Directly write single version packages
  await Promise.all(
    singleVersionPackages.map((pkgName) => {
      const pkg = tracedPackages[pkgName];
      const version = Object.keys(pkg!.versions)[0];
      return writePackage(pkgName, version!);
    }),
  );

  // Write packages with multiple versions
  for (const [pkgName, pkgVersions] of Object.entries(multiVersionPkgs)) {
    const versionEntries = Object.entries(pkgVersions).sort(([v1, p1], [v2, p2]) => {
      // 1. Most dependants to be hoisted (0 parents = root-level = most implicit dependants)
      const d1 = p1.length === 0 ? Infinity : p1.length;
      const d2 = p2.length === 0 ? Infinity : p2.length;
      if (d1 !== d2) {
        return d2 - d1;
      }
      // 2. Newest version to be hoisted
      return compareVersions(v1, v2);
    });
    for (const [version, parentPkgs] of versionEntries) {
      // Write each version into node_modules/.nf3/{name}@{version}
      await writePackage(pkgName, version, `.nf3/${pkgName}@${version}`);
      // Link one version to the top level (for indirect bundle deps)
      await linkPackage(`.nf3/${pkgName}@${version}`, `${pkgName}`);
      // Link to parent packages
      for (const parentPkg of parentPkgs) {
        const parentPkgName = parentPkg.replace(/@[^@]+$/, "");
        await (multiVersionPkgs[parentPkgName]
          ? linkPackage(`.nf3/${pkgName}@${version}`, `.nf3/${parentPkg}/node_modules/${pkgName}`)
          : linkPackage(`.nf3/${pkgName}@${version}`, `${parentPkgName}/node_modules/${pkgName}`));
      }
    }
  }

  // Write an informative package.json
  if (opts.writePackageJson) {
    await writeJSON(resolve(outDir, "../package.json"), {
      name: "traced-node-modules",
      version: "1.0.0",
      type: "module",
      private: true,
      dependencies: Object.fromEntries(
        [
          ...Object.values(tracedPackages).map((pkg) => [pkg.name, Object.keys(pkg.versions)[0]]),
          ...Object.entries(usedAliases),
        ].sort(([a], [b]) => a!.localeCompare(b!)),
      ),
    });
  }
}

async function resolveTracedPath(base: string, p: string) {
  try {
    return normalize(await fsp.realpath(resolve(base, p)));
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

/** Turn an nft trace result into a `path -> TracedFile` map (node_modules only). */
async function resolveTracedFiles(
  traceResult: Awaited<ReturnType<typeof nodeFileTrace>>,
  base: string,
): Promise<Record<string, TracedFile>> {
  return Object.fromEntries(
    (await Promise.all(
      [...traceResult.reasons.entries()].map(async ([_path, reasons]) => {
        if (reasons.ignored) {
          return;
        }
        const path = await resolveTracedPath(base, _path);
        if (!path?.includes("node_modules")) {
          return;
        }
        if (!(await isFile(path))) {
          return;
        }
        const { dir: baseDir, name: pkgName, subpath } = parseNodeModulePath(path);
        if (!baseDir || !pkgName) {
          return;
        }
        const pkgPath = join(baseDir, pkgName);
        const parents = (
          await Promise.all([...reasons.parents].map((p) => resolveTracedPath(base, p)))
        ).filter((p): p is string => p !== undefined);
        const tracedFile = <TracedFile>{ path, parents, subpath, pkgName, pkgPath };
        return [path, tracedFile];
      }),
    ).then((r) => r.filter(Boolean))) as [string, TracedFile][],
  );
}

/**
 * Group traced files into `tracedPackages` by name/version. Idempotent across
 * calls via `seenFiles`, so a follow-up transitive trace can merge new files
 * without re-adding ones already assigned.
 */
async function indexTracedFiles(
  files: TracedFile[],
  ctx: {
    tracedFiles: Record<string, TracedFile>;
    tracedPackages: Record<string, TracedPackage>;
    pkgCache: Map<string, PackageJson>;
    seenFiles: Set<string>;
    fullTraceInclude: ExternalsTraceOptions["fullTraceInclude"];
  },
) {
  const { tracedFiles, tracedPackages, pkgCache, seenFiles, fullTraceInclude } = ctx;
  for (const tracedFile of files) {
    if (seenFiles.has(tracedFile.path)) {
      continue;
    }
    seenFiles.add(tracedFile.path);
    tracedFiles[tracedFile.path] = tracedFile;

    // Use `node_modules/{name}` in path as name to support aliases
    const pkgName = tracedFile.pkgName;
    let tracedPackage = tracedPackages[pkgName];
    let pkgJSON = pkgCache.get(tracedFile.pkgPath) as PackageJson;
    if (!pkgJSON) {
      pkgJSON = await readJSON(join(tracedFile.pkgPath, "package.json")).catch(() => {
        return { name: pkgName, version: "0.0.0" };
      });
      pkgCache.set(tracedFile.pkgPath, pkgJSON);
    }

    if (!tracedPackage) {
      tracedPackage = {
        name: pkgName,
        versions: {},
      };
      tracedPackages[pkgName] = tracedPackage;
    }
    let tracedPackageVersion = tracedPackage.versions[pkgJSON.version || "0.0.0"];
    if (!tracedPackageVersion) {
      tracedPackageVersion = {
        path: tracedFile.pkgPath,
        files: [],
        pkgJSON,
      };
      tracedPackage.versions[pkgJSON.version || "0.0.0"] = tracedPackageVersion;

      const fullTraceEntry = resolveFullTraceEntry(fullTraceInclude, pkgName);
      if (fullTraceEntry) {
        if (fullTraceEntry.glob) {
          if (!fsp.glob) {
            throw new Error(
              "`fullTraceInclude` glob requires Node.js >= 22.0.0 (fs.promises.glob)",
            );
          }
          for await (const file of fsp.glob(fullTraceEntry.glob, {
            cwd: tracedFile.pkgPath,
            exclude: (name) => name === "node_modules",
          })) {
            const fullPath = join(tracedFile.pkgPath, file);
            if (await isFile(fullPath)) {
              tracedPackageVersion.files.push(fullPath);
            }
          }
        } else {
          tracedPackageVersion.files.push(...(await listPkgFiles(tracedFile.pkgPath)));
        }
      }
    }
    tracedPackageVersion.files.push(tracedFile.path);
    tracedFile.pkgName = pkgName;
    if (pkgJSON.version) {
      tracedFile.pkgVersion = pkgJSON.version;
    }
  }
}

function compareVersions(v1 = "0.0.0", v2 = "0.0.0") {
  try {
    return semver.lt(v1, v2, { loose: true }) ? 1 : -1;
  } catch {
    return v1.localeCompare(v2);
  }
}

export function applyProductionCondition(exports: PackageJson["exports"]) {
  if (!exports || typeof exports === "string" || Array.isArray(exports) /* TODO: unhandled */) {
    return;
  }
  if ("production" in exports) {
    if (typeof exports.production === "string") {
      exports.default = exports.production;
    } else {
      Object.assign(exports, exports.production);
    }
  }
  for (const key in exports) {
    if (key === "production") continue;
    applyProductionCondition(exports[key as keyof typeof exports]);
  }
}

function resolveFullTraceEntry(
  entries: ExternalsTraceOptions["fullTraceInclude"],
  pkgName: string,
): { glob?: string } | undefined {
  if (!entries) {
    return undefined;
  }
  for (const entry of entries) {
    if (typeof entry === "string") {
      if (entry === pkgName) {
        return {};
      }
    } else if (entry[0] === pkgName) {
      return entry[1];
    }
  }
  return undefined;
}

async function listPkgFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await fsp.readdir(dir, {
    recursive: true,
    withFileTypes: true,
  })) {
    const fullPath = join(entry.parentPath, entry.name);
    const relPath = fullPath.slice(dir.length);
    if (relPath.split("/").includes("node_modules")) {
      continue;
    }
    if (entry.isFile() || (entry.isSymbolicLink() && (await isFile(fullPath)))) {
      files.push(fullPath);
    }
  }
  return files;
}

async function isFile(file: string) {
  try {
    const stat = await fsp.stat(file);
    return stat.isFile();
  } catch (error) {
    if ((error as any)?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
