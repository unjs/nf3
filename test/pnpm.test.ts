import { beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";
import { lstat, mkdir, rm, symlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import * as rolldown from "rolldown";

import { externals } from "../src/plugin.ts";

// Reproduction for https://github.com/unjs/nf3/issues/49
//
// pnpm does not hoist transitive dependencies to the top-level `node_modules`.
// A native, non-bundleable dependency (e.g. `sharp` / `bcrypt`) that is only an
// indirect dependency lives exclusively under `node_modules/.pnpm/...` and is
// reached via symlinks. Because such packages load their native binary
// dynamically, nft cannot statically trace them, so they must be force-traced
// via `traceInclude` (nitro's `traceDeps`). nf3 resolves those names from
// `rootDir`, where the package does not exist under pnpm — so tracing fails.

const fixtureDir = fileURLToPath(new URL("fixture-pnpm", import.meta.url));
const nodeModules = `${fixtureDir}/node_modules`;

// Symlinks that pnpm would create on install. Recreated here so we don't have to
// commit platform-fragile symlinks (see test/fixture-pnpm/.gitignore).
const symlinks: [link: string, target: string][] = [
  // top-level dependency -> its package in the virtual store
  [
    `${nodeModules}/@fixture/pnpm-app`,
    "../.pnpm/@fixture+pnpm-app@1.0.0/node_modules/@fixture/pnpm-app",
  ],
  // pnpm-app's nested (non-hoisted) native dependency
  [
    `${nodeModules}/.pnpm/@fixture+pnpm-app@1.0.0/node_modules/@fixture/pnpm-native`,
    "../../../@fixture+pnpm-native@1.0.0/node_modules/@fixture/pnpm-native",
  ],
];

describe("pnpm .pnpm nested dependency tracing", () => {
  beforeAll(async () => {
    for (const [link, target] of symlinks) {
      await mkdir(fileURLToPath(new URL(".", `file://${link}`)), { recursive: true });
      await rm(link, { force: true });
      await symlink(target, link, "dir");
    }
    // Sanity check: the layout mirrors pnpm (native dep reachable only via .pnpm).
    expect((await lstat(`${nodeModules}/@fixture/pnpm-app`)).isSymbolicLink()).toBe(true);
    expect(existsSync(`${nodeModules}/@fixture/pnpm-native`)).toBe(false);
  });

  it("traces a nested native dependency from the .pnpm store", async () => {
    const outDir = `${fixtureDir}/.output`;
    await rm(outDir, { recursive: true, force: true });

    await rolldown.build({
      input: `${fixtureDir}/index.mjs`,
      output: { dir: outDir, format: "esm" },
      external: [...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
      plugins: [
        externals({
          rootDir: fixtureDir,
          traceInclude: ["@fixture/pnpm-native"],
          trace: { outDir, fullTraceInclude: ["@fixture/pnpm-native"] },
        }),
      ],
    });

    const nativeDir = `${outDir}/node_modules/@fixture/pnpm-native`;
    expect(existsSync(nativeDir), "native package directory traced").toBe(true);
    expect(existsSync(`${nativeDir}/native.node`), "native binary copied").toBe(true);
  });
});
