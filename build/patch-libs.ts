import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Plugin } from "rollup";

const shimPath = (name: string) => fileURLToPath(new URL(`shims/${name}`, import.meta.url));
const readShim = (name: string) => readFileSync(shimPath(name), "utf8");

// Patches for dependencies bundled into dist (keyed by path suffix inside node_modules)
// Each patch must match exactly as many times as expected, so upstream changes fail the build
// instead of silently shipping unpatched code.
const LIB_PATCHES: Record<string, (code: string) => string> = {
  // `eval('require.resolve(...)')` hides `require` from bundlers, but `require` is not in scope
  // in ESM output (nbind locator would silently find nothing)
  "@vercel/nft/out/utils/binary-locators.js": (code) =>
    replaceOrThrow(code, /eval\('require\.resolve\((\w+)\)'\)/g, "require.resolve($1)", 2),

  // Pass `[dir, pattern]` to the glob shim so `dir` is used literally as `cwd`
  // (paths may contain glob syntax such as `(` or `[`)
  "@vercel/nft/out/analyze.js": (code) =>
    replaceOrThrow(
      code,
      /\(0, glob_1\.glob\)\((\w+) \+ wildcardPattern, \{/g,
      "(0, glob_1.glob)([$1, wildcardPattern], {",
      2,
    ),
  // Extensionless assets are analyzed as code, so non-regular files (e.g. a Chromium
  // `SingletonSocket`) crash `readFile`; emit those as plain assets instead
  // https://github.com/vercel/nft/issues/616
  "@vercel/nft/out/node-file-trace.js": (code) =>
    replaceOrThrow(
      code,
      "ext === '' ||",
      "(ext === '' && (await this.stat(asset))?.isFile()) ||",
      1,
    ),
  "@vercel/nft/out/utils/sharedlib-emit.js": (code) =>
    replaceOrThrow(
      code,
      /\(0, glob_1\.glob\)\((pkgPath\.replaceAll\([^)]+\)) \+ sharedlibGlob, \{/g,
      "(0, glob_1.glob)([$1, sharedlibGlob], {",
      1,
    ),

  "@mapbox/node-pre-gyp/lib/node-pre-gyp.js": () => readShim("node-pre-gyp.cjs"),
  "@mapbox/node-pre-gyp/lib/util/log.js": () => readShim("node-pre-gyp-log.cjs"),
  "@mapbox/node-pre-gyp/lib/util/versioning.js": (code) => {
    // ABI crosswalk is only used with an explicit `target` node version (never passed by nft)
    code = replaceOrThrow(code, "require('./abi_crosswalk.json')", "{}", 1);
    // Only `semver.parse` is used; avoid bundling all of semver
    return replaceOrThrow(
      code,
      "require('semver')",
      "{ parse: require('semver/functions/parse') }",
      1,
    );
  },
};

export function patchLibs(): Plugin {
  return {
    name: "patch-libs",
    resolveId: {
      order: "pre",
      handler(id, importer) {
        // Replace `glob` with `tinyglobby` for @vercel/nft
        if (id === "glob" && importer && /[/\\]@vercel[/\\]nft[/\\]/.test(importer)) {
          return shimPath("glob.mjs");
        }
      },
    },
    transform(code, id) {
      const normalizedId = id.replaceAll("\\", "/");
      for (const [suffix, patch] of Object.entries(LIB_PATCHES)) {
        if (normalizedId.endsWith(`/node_modules/${suffix}`)) {
          return patch(code);
        }
      }
    },
  };
}

function replaceOrThrow(
  code: string,
  search: string | RegExp,
  replacement: string,
  expectedCount: number,
): string {
  let count = 0;
  const result = code.replaceAll(search, (...args) => {
    count++;
    return typeof search === "string"
      ? replacement
      : replacement.replace(/\$(\d)/g, (_, i) => args[Number(i)]);
  });
  if (count !== expectedCount) {
    throw new Error(
      `[patch-libs] Expected ${expectedCount} match(es) for ${search}, found ${count}`,
    );
  }
  return result;
}
