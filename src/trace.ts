import type { PackageJson } from "pkg-types";
import type {
  ExternalsTraceOptions,
  TracedFile,
  TracedPackage,
} from "./types.ts";
import { promises as fsp } from "node:fs";
import { platform } from "node:os";
import { nodeFileTrace } from "@vercel/nft";
import { parseNodeModulePath } from "mlly";
import { dirname, join, relative, resolve } from "pathe";
import { readPackageJSON, writePackageJSON } from "pkg-types";
import semver from "semver";

export async function traceNodeModules(
  input: string[],
  opts: ExternalsTraceOptions,
) {
  await opts?.hooks?.traceStart?.(input);

  // Trace used files using nft
  const traceResult = await nodeFileTrace([...input], {
    // https://github.com/nitrojs/nitro/pull/1562
    conditions: (opts.exportConditions || ["node", "import", "default"]).filter(
      (c) => !["require", "import", "default"].includes(c),
    ),
    ...opts.traceOptions,
  });

  await opts?.hooks?.traceResult?.(traceResult);

  // Resolve traced files
  const _resolveTracedPath = (p: string) =>
    fsp.realpath(resolve(opts.traceOptions?.base || ".", p));

  const tracedFiles: Record<string, TracedFile> = Object.fromEntries(
    (await Promise.all(
      [...traceResult.reasons.entries()].map(async ([_path, reasons]) => {
        if (reasons.ignored) {
          return;
        }
        const path = await _resolveTracedPath(_path);
        if (!path.includes("node_modules")) {
          return;
        }
        if (!(await isFile(path))) {
          return;
        }
        const {
          dir: baseDir,
          name: pkgName,
          subpath,
        } = parseNodeModulePath(path);
        if (!baseDir || !pkgName) {
          return;
        }
        const pkgPath = join(baseDir, pkgName);
        const parents = await Promise.all(
          [...reasons.parents].map((p) => _resolveTracedPath(p)),
        );
        const tracedFile = <TracedFile>{
          path,
          parents,

          subpath,
          pkgName,
          pkgPath,
        };
        return [path, tracedFile];
      }),
    ).then((r) => r.filter(Boolean))) as [string, TracedFile][],
  );

  await opts?.hooks?.traceFiles?.(tracedFiles);

  // Resolve traced packages
  const tracedPackages: Record<string, TracedPackage> = {};
  for (const tracedFile of Object.values(tracedFiles)) {
    // Use `node_modules/{name}` in path as name to support aliases
    const pkgName = tracedFile.pkgName;
    let tracedPackage = tracedPackages[pkgName];

    // Read package.json for file
    let pkgJSON = await readPackageJSON(tracedFile.pkgPath, {
      cache: true,
    }).catch(
      () => {}, // TODO: Only catch ENOENT
    );
    if (!pkgJSON) {
      pkgJSON = <PackageJson>{ name: pkgName, version: "0.0.0" };
    }
    if (!tracedPackage) {
      tracedPackage = {
        name: pkgName,
        versions: {},
      };
      tracedPackages[pkgName] = tracedPackage;
    }
    let tracedPackageVersion =
      tracedPackage.versions[pkgJSON.version || "0.0.0"];
    if (!tracedPackageVersion) {
      tracedPackageVersion = {
        path: tracedFile.pkgPath,
        files: [],
        pkgJSON,
      };
      tracedPackage.versions[pkgJSON.version || "0.0.0"] = tracedPackageVersion;
    }
    tracedPackageVersion.files.push(tracedFile.path);
    tracedFile.pkgName = pkgName;
    if (pkgJSON.version) {
      tracedFile.pkgVersion = pkgJSON.version;
    }
  }

  await opts?.hooks?.tracedPackages?.(tracedPackages);

  const usedAliases: Record<string, string> = {};

  const outDir = resolve(
    opts.rootDir || ".",
    opts.outDir || "dist",
    "node_modules",
  );

  const writePackage = async (
    name: string,
    version: string,
    _pkgPath?: string,
  ) => {
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
      await fsp.copyFile(src, dst);
      if (opts.chmod) {
        await fsp.chmod(dst, opts.chmod === true ? 0o644 : opts.chmod);
      }
    }

    // Copy package.json
    const pkgJSON = pkg.versions[version]!.pkgJSON;
    applyProductionCondition(pkgJSON.exports);
    const pkgJSONPath = join(outDir, pkgPath, "package.json");
    await fsp.mkdir(dirname(pkgJSONPath), { recursive: true });
    await fsp.writeFile(pkgJSONPath, JSON.stringify(pkgJSON, null, 2), "utf8");

    // Link aliases
    if (opts.traceAlias && opts.traceAlias[pkgPath]) {
      usedAliases[opts.traceAlias[pkgPath]] = version;
      await linkPackage(pkgPath, opts.traceAlias[pkgPath]);
    }
  };

  const isWindows = platform() === "win32";
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
    const versionFiles: TracedFile[] = pkg.versions[version]!.files.map(
      (path) => tracedFiles[path]!,
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
      multiVersionPkgs[tracedPackage.name]![version] = findPackageParents(
        tracedPackage,
        version,
      );
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
    const versionEntries = Object.entries(pkgVersions).sort(
      ([v1, p1], [v2, p2]) => {
        // 1. Package with no parent packages to be hoisted
        if (p1.length === 0) {
          return -1;
        }
        if (p2.length === 0) {
          return 1;
        }
        // 2. Newest version to be hoisted
        return compareVersions(v1, v2);
      },
    );
    for (const [version, parentPkgs] of versionEntries) {
      // Write each version into node_modules/.nft/{name}@{version}
      await writePackage(pkgName, version, `.nft/${pkgName}@${version}`);
      // Link one version to the top level (for indirect bundle deps)
      await linkPackage(`.nft/${pkgName}@${version}`, `${pkgName}`);
      // Link to parent packages
      for (const parentPkg of parentPkgs) {
        const parentPkgName = parentPkg.replace(/@[^@]+$/, "");
        await (multiVersionPkgs[parentPkgName]
          ? linkPackage(
              `.nft/${pkgName}@${version}`,
              `.nft/${parentPkg}/node_modules/${pkgName}`,
            )
          : linkPackage(
              `.nft/${pkgName}@${version}`,
              `${parentPkgName}/node_modules/${pkgName}`,
            ));
      }
    }
  }

  // Write an informative package.json
  if (opts.writePackageJson) {
    await writePackageJSON(resolve(outDir, "../package.json"), {
      name: "traced-node-modules",
      version: "1.0.0",
      type: "module",
      private: true,
      dependencies: Object.fromEntries(
        [
          ...Object.values(tracedPackages).map((pkg) => [
            pkg.name,
            Object.keys(pkg.versions)[0],
          ]),
          ...Object.entries(usedAliases),
        ].sort(([a], [b]) => a!.localeCompare(b!)),
      ),
    });
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
  if (
    !exports ||
    typeof exports === "string" ||
    Array.isArray(exports) /* TODO: unhandled */
  ) {
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
    applyProductionCondition(exports[key as keyof typeof exports]);
  }
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
