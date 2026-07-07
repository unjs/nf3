import { beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";
import { lstat, mkdir, readFile, rm, symlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import * as rolldown from "rolldown";

import { externals } from "../src/plugin.ts";
import { traceNodeModules } from "../src/index.ts";

// Regression test for https://github.com/unjs/nf3/issues/49
//
// pnpm does not hoist transitive dependencies to the top-level `node_modules`.
// A native, non-bundleable dependency (e.g. `sharp` / `bcrypt`) that is only an
// indirect dependency lives exclusively under `node_modules/.pnpm/...` and is
// reached via symlinks. Because such packages load their native binary
// dynamically, nft cannot statically trace them, so they must be force-traced
// via `traceInclude` (nitro's `traceDeps`). Resolving those names only from
// `rootDir` fails under pnpm; `traceInclude` must resolve them from the
// dependent package's real `.pnpm` location.
//
// The fixture also has an unrelated decoy copy of the native dep hoisted at the
// project root (`@fixture/pnpm-native@9.9.9`, no native.node). Resolution must
// prefer the version `pnpm-app` actually depends on (1.0.0, nested in .pnpm)
// over the root decoy.

const NESTED_VERSION = "1.0.0";

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
    // Sanity check: the layout mirrors pnpm. pnpm-app is symlinked from the
    // store, and the only top-level copy of the native dep is the decoy.
    expect((await lstat(`${nodeModules}/@fixture/pnpm-app`)).isSymbolicLink()).toBe(true);
    const rootDecoy = JSON.parse(
      await readFile(`${nodeModules}/@fixture/pnpm-native/package.json`, "utf8"),
    );
    expect(rootDecoy.version).toBe("9.9.9");
  });

  async function expectTracedNativeVersion(nativeDir: string) {
    expect(existsSync(nativeDir), "native package directory traced").toBe(true);
    const traced = JSON.parse(await readFile(`${nativeDir}/package.json`, "utf8"));
    expect(traced.version, "picks the dependent's nested version, not the root decoy").toBe(
      NESTED_VERSION,
    );
    expect(existsSync(`${nativeDir}/native.node`), "native binary copied").toBe(true);
  }

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
          trace: { outDir },
        }),
      ],
    });

    await expectTracedNativeVersion(`${outDir}/node_modules/@fixture/pnpm-native`);
  });

  // Root-cause coverage at the level nitro consumes nf3: nitro uses its own
  // externals plugin and only calls `traceNodeModules`, passing `traceDeps` as
  // names. The native dep here is NOT statically imported by pnpm-app, so it can
  // only enter the trace via `traceInclude` resolved against the declaring
  // package's root (not rootDir, where only the decoy lives).
  it("traceNodeModules resolves traceInclude against the declaring package root", async () => {
    const outDir = `${fixtureDir}/.output-trace`;
    await rm(outDir, { recursive: true, force: true });

    const appEntry = `${nodeModules}/.pnpm/@fixture+pnpm-app@1.0.0/node_modules/@fixture/pnpm-app/index.mjs`;
    await traceNodeModules([appEntry], {
      rootDir: fixtureDir,
      outDir,
      traceInclude: ["@fixture/pnpm-native"],
    });

    await expectTracedNativeVersion(`${outDir}/node_modules/@fixture/pnpm-native`);
  });

  // The declarer of the native dep (`pnpm-app`) is *bundled*, not externalized,
  // so it never becomes a traced package and cannot contribute a declarer root.
  // nitro supplies the roots of bundled packages via `traceIncludeRoots`, which
  // is the only way the nested native dep can be resolved from the version the
  // dependent actually uses. https://github.com/unjs/nf3/issues/49
  it("resolves traceInclude against a bundled declarer via traceIncludeRoots", async () => {
    const outDir = `${fixtureDir}/.output-bundled`;
    await rm(outDir, { recursive: true, force: true });

    const appRoot = `${nodeModules}/.pnpm/@fixture+pnpm-app@1.0.0/node_modules/@fixture/pnpm-app`;
    await traceNodeModules([`${fixtureDir}/bundled-entry.mjs`], {
      rootDir: fixtureDir,
      outDir,
      traceInclude: ["@fixture/pnpm-native"],
      traceIncludeRoots: [appRoot],
    });

    await expectTracedNativeVersion(`${outDir}/node_modules/@fixture/pnpm-native`);
  });

  // Guards the fix above: without `traceIncludeRoots`, a bundled declarer's
  // nested native dep resolves only from `rootDir`, which under pnpm holds just
  // the unrelated hoisted decoy (9.9.9, no native binary) — never the 1.0.0 the
  // dependent actually uses.
  it("without traceIncludeRoots, a bundled declarer's nested native dep is missed", async () => {
    const outDir = `${fixtureDir}/.output-bundled-nofix`;
    await rm(outDir, { recursive: true, force: true });

    await traceNodeModules([`${fixtureDir}/bundled-entry.mjs`], {
      rootDir: fixtureDir,
      outDir,
      traceInclude: ["@fixture/pnpm-native"],
    });

    const nativeDir = `${outDir}/node_modules/@fixture/pnpm-native`;
    const traced = existsSync(`${nativeDir}/package.json`)
      ? JSON.parse(await readFile(`${nativeDir}/package.json`, "utf8"))
      : undefined;
    // Only the decoy is reachable from rootDir, and it ships no native binary.
    expect(traced?.version).not.toBe(NESTED_VERSION);
    expect(existsSync(`${nativeDir}/native.node`)).toBe(false);
  });
});
