import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { isAbsolute, join } from "pathe";

import type { PackageJson } from "pkg-types";

export const isWindows = process.platform === "win32";

const NODE_MODULES_RE =
  /^(?<dir>.+[\\/]node_modules[\\/])(?<name>[^@\\/]+|@[^\\/]+[\\/][^\\/]+)(?:[\\/](?<subpath>.+))?$/;

export function parseNodeModulePath(path: string): {
  dir?: string;
  name?: string;
  subpath?: string;
} {
  return NODE_MODULES_RE.exec(path)?.groups || {};
}

const IMPORT_RE = /^(?!\.)(?<name>[^@/\\]+|@[^/\\]+[/\\][^/\\]+)(?:[/\\](?<subpath>.+))?$/;

export function toImport(id: string): string | undefined {
  if (isAbsolute(id)) {
    const { name, subpath } = parseNodeModulePath(id) || {};
    if (name && subpath) {
      return join(name, subpath);
    }
  } else if (IMPORT_RE.test(id)) {
    return id;
  }
}

export function guessSubpath(path: string, conditions: string[]): string | undefined {
  const { dir, name, subpath } = NODE_MODULES_RE.exec(path)?.groups || {};
  if (!dir || !name || !subpath) {
    return;
  }
  const pkgDir = join(dir, name) + "/";
  const exports = getPkgJSON(pkgDir)?.exports;
  if (!exports || typeof exports !== "object") {
    return;
  }
  for (const e of flattenExports(exports)) {
    if (!conditions.includes(e.condition || "default")) {
      continue;
    }
    if (e.fsPath === subpath) {
      return join(name, e.subpath);
    }
    if (e.fsPath.includes("*")) {
      const fsPathRe: RegExp = new RegExp(
        "^" + escapeRegExp(e.fsPath).replace(String.raw`\*`, "(.+?)") + "$",
      );
      if (fsPathRe.test(subpath)) {
        const matched = fsPathRe.exec(subpath)?.[1];
        if (matched) {
          return join(name, e.subpath.replace("*", matched));
        }
      }
    }
  }
}

export function getPkgJSON(dir: string): PackageJson | undefined {
  const cache = ((getPkgJSON as any)._cache ||= new Map<string, PackageJson>());
  if (cache.has(dir)) {
    return cache.get(dir);
  }
  try {
    const pkg = createRequire(dir)("./package.json");
    cache.set(dir, pkg);
    return pkg;
  } catch {
    /* ignore */
  }
}

// Based on mlly
function flattenExports(
  exports: Exclude<PackageJson["exports"], string> = {},
  parentSubpath = "./",
): { subpath: string; fsPath: string; condition?: string }[] {
  return Object.entries(exports).flatMap(([key, value]) => {
    const [subpath, condition] = key.startsWith(".") ? [key.slice(1)] : [undefined, key];
    const _subPath = join(parentSubpath, subpath || "");
    if (typeof value === "string") {
      return [{ subpath: _subPath, fsPath: value.replace(/^\.\//, ""), condition }];
    }
    return typeof value === "object" ? flattenExports(value, _subPath) : [];
  });
}

export function escapeRegExp(string: string): string {
  return string.replace(/[-\\^$*+?.()|[\]{}]/g, String.raw`\$&`);
}

export async function readJSON(path: string): Promise<any> {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function writeJSON(path: string, data: any): Promise<void> {
  return await writeFile(path, JSON.stringify(data, null, 2), "utf8");
}

export function pathRegExp(string: string): string {
  if (isWindows) {
    string = string.replace(/\\/g, "/");
  }
  let escaped = escapeRegExp(string);
  if (isWindows) {
    escaped = escaped.replace(/\//g, String.raw`[/\\]`);
  }
  return escaped;
}

export function toPathRegExp(input: string | RegExp): RegExp {
  if (input instanceof RegExp) {
    return input;
  }
  if (typeof input === "string") {
    return new RegExp(pathRegExp(input));
  }
  throw new TypeError("Expected a string or RegExp", { cause: input });
}
