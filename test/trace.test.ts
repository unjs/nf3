import { describe, expect, it, vi } from "vitest";
import { traceNodeModules } from "../src/index.ts";
import { fileURLToPath } from "node:url";
import { cp, rm, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { TraceHooks } from "../src/types.ts";

describe("traceNodeModules", () => {
  it("traceNodeModules", async () => {
    const input = fileURLToPath(new URL("fixture/index.mjs", import.meta.url));
    const outDir = fileURLToPath(new URL("dist/trace", import.meta.url));

    await cp(input, `${outDir}/index.mjs`);

    const hooks: TraceHooks = {
      traceStart: vi.fn(),
      traceResult: vi.fn(),
      tracedFiles: vi.fn(),
      tracedPackages: vi.fn(),
    };

    await traceNodeModules([input], { outDir, hooks });

    const entry = await import(`${outDir}/index.mjs`);

    expect(entry.default).toMatchObject({
      depA: "@fixture/nitro-lib@1.0.0+@fixture/nested-lib@1.0.0",
      depB: "@fixture/nitro-lib@2.0.1+@fixture/nested-lib@2.0.1",
      depLib: "@fixture/nitro-lib@2.0.0+@fixture/nested-lib@2.0.0",
      extraUtils: "@fixture/nitro-utils/extra",
      subpathLib: "@fixture/nitro-lib@2.0.0",
    });

    expect(hooks.traceStart).toHaveBeenCalledOnce();
    expect(hooks.traceResult).toHaveBeenCalledOnce();
    expect(hooks.tracedFiles).toHaveBeenCalledOnce();
    expect(hooks.tracedPackages).toHaveBeenCalledOnce();
  });

  it("traceNodeModules with fullTraceInclude", async () => {
    const input = fileURLToPath(new URL("fixture/index.mjs", import.meta.url));
    const outDir = fileURLToPath(new URL("dist/trace", import.meta.url));

    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });
    await cp(input, `${outDir}/index.mjs`);
    await traceNodeModules([input], { outDir, fullTraceInclude: ["@fixture/nitro-utils"] });

    expect(
      await readFile(path.join(outDir, "node_modules", "@fixture", "nitro-utils", "README.md"), {
        encoding: "utf8",
      }),
    ).toMatch("# Title");
  });

  // Regression for https://github.com/nodejs/orchestrion-js/issues/80
  // A package force-included via `traceInclude` (e.g. orchestrion, loaded at
  // runtime through `node --import` rather than statically imported) is copied
  // whole, but its runtime dependencies must be followed transitively too —
  // otherwise the output crashes at runtime with a missing module (e.g. the
  // `meriyah` parser that orchestrion requires).
  it("traces transitive dependencies of a traceInclude package", async () => {
    const rootDir = fileURLToPath(new URL("fixture", import.meta.url));
    const input = fileURLToPath(new URL("fixture/force-include.mjs", import.meta.url));
    const outDir = fileURLToPath(new URL("dist/force-include", import.meta.url));

    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });
    await cp(input, `${outDir}/force-include.mjs`);

    await traceNodeModules([input], {
      rootDir,
      outDir,
      traceInclude: ["@fixture/force-included"],
    });

    const scope = path.join(outDir, "node_modules", "@fixture");
    // The force-included package itself is copied...
    await expect(stat(path.join(scope, "force-included", "index.mjs"))).resolves.toBeTruthy();
    // ...along with its direct runtime dependency...
    await expect(stat(path.join(scope, "transitive-a", "index.mjs"))).resolves.toBeTruthy();
    // ...and the transitive-of-transitive dependency.
    await expect(stat(path.join(scope, "transitive-b", "index.mjs"))).resolves.toBeTruthy();
  });

  // Regression for the multi-version dedup of a traceInclude package's own
  // runtime dependency. `@fixture/force-included-mv` (force-traced) needs
  // `@fixture/mv-dep@1.0.0`, while the app statically imports `@fixture/mv-dep@2.0.0`.
  // The force-included package's files must be attributed as the parent of its
  // transitive dep so dedup links v1.0.0 under it — otherwise it resolves the
  // hoisted v2.0.0 at runtime.
  it("dedups a traceInclude package's own multi-version dependency", async () => {
    const rootDir = fileURLToPath(new URL("fixture", import.meta.url));
    const input = fileURLToPath(new URL("fixture/force-include-mv.mjs", import.meta.url));
    const outDir = fileURLToPath(new URL("dist/force-include-mv", import.meta.url));

    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });
    await cp(input, `${outDir}/force-include-mv.mjs`);

    await traceNodeModules([input], {
      rootDir,
      outDir,
      traceInclude: ["@fixture/force-included-mv"],
    });

    // The app entry resolves the hoisted (newer) version at the top level.
    const app = await import(`${outDir}/force-include-mv.mjs`);
    expect(app.default).toBe("@fixture/mv-dep@2.0.0");

    // The force-included package must still resolve its own (older) version,
    // linked under its `node_modules` rather than falling back to the hoisted one.
    const forceIncluded = await import(
      path.join(outDir, "node_modules", "@fixture", "force-included-mv", "index.mjs")
    );
    expect(forceIncluded.default).toBe("@fixture/force-included-mv@1.0.0+@fixture/mv-dep@1.0.0");
  });

  // The transitive trace of a traceInclude package must follow only its declared
  // runtime entry points, not every shipped `.js`. `@fixture/force-included-dev`
  // ships a `build.config.mjs` importing a devDependency that its runtime entry
  // never touches; that devDependency must stay out of the output.
  it("does not follow dev-only files when tracing a traceInclude package", async () => {
    const rootDir = fileURLToPath(new URL("fixture", import.meta.url));
    const input = fileURLToPath(new URL("fixture/force-include-dev.mjs", import.meta.url));
    const outDir = fileURLToPath(new URL("dist/force-include-dev", import.meta.url));

    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });
    await cp(input, `${outDir}/force-include-dev.mjs`);

    await traceNodeModules([input], {
      rootDir,
      outDir,
      traceInclude: ["@fixture/force-included-dev"],
    });

    const scope = path.join(outDir, "node_modules", "@fixture");
    // The runtime dependency (reachable from the entry) is traced and copied...
    await expect(stat(path.join(scope, "runtime-dep", "index.mjs"))).resolves.toBeTruthy();
    // ...but the devDependency, only reachable from `build.config.mjs`, is not.
    await expect(stat(path.join(scope, "dev-dep"))).rejects.toThrow();
  });

  // Regression for https://github.com/unjs/nf3/issues/57
  // A package force-included via `traceInclude` whose `exports` map is keyed only
  // by `import`/`require` (no top-level `default` or `./package.json` export) must
  // still resolve when the caller passes minimal `conditions` (e.g. Nitro's
  // `["node"]`). Previously it was silently dropped because resolution used the
  // raw caller conditions, which match none of the package's export keys.
  it("traces a traceInclude package with import/require-only exports under minimal conditions", async () => {
    const rootDir = fileURLToPath(new URL("fixture", import.meta.url));
    const input = fileURLToPath(new URL("fixture/force-include-conditions.mjs", import.meta.url));
    const outDir = fileURLToPath(new URL("dist/force-include-conditions", import.meta.url));

    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });
    await cp(input, `${outDir}/force-include-conditions.mjs`);

    await traceNodeModules([input], {
      rootDir,
      outDir,
      conditions: ["node"],
      traceInclude: ["@fixture/conditional-exports"],
    });

    const scope = path.join(outDir, "node_modules", "@fixture");
    // The force-included package (import/require-only exports) is copied...
    await expect(stat(path.join(scope, "conditional-exports", "index.mjs"))).resolves.toBeTruthy();
    // ...along with its transitively-traced runtime dependency.
    await expect(stat(path.join(scope, "conditional-dep", "index.mjs"))).resolves.toBeTruthy();
  });

  // Regression for https://github.com/unjs/nf3/issues/47
  // `@fixture/native-libvips` mirrors `@img/sharp-libvips-*`: it is declared only
  // as an `optionalDependency` (loaded at runtime via native `@rpath` links, with
  // no JS import) and ships a restrictive `exports` map that omits both `.` and
  // `./package.json`. Resolving `<dep>/package.json` therefore fails, so the dep
  // must be discovered by walking `node_modules` and copied into the output.
  it("traces optionalDependencies with a restrictive exports map", async () => {
    const input = fileURLToPath(new URL("fixture/native.mjs", import.meta.url));
    const outDir = fileURLToPath(new URL("dist/native", import.meta.url));

    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });
    await cp(input, `${outDir}/native.mjs`);

    await traceNodeModules([input], { outDir });

    const libvipsDir = path.join(outDir, "node_modules", "@fixture", "native-libvips");

    // The manifest is copied even though it is not exposed via `exports`.
    expect(await readFile(path.join(libvipsDir, "package.json"), "utf8")).toContain(
      "@fixture/native-libvips",
    );
    // The native binary (the whole point of the package) must be copied too.
    await expect(stat(path.join(libvipsDir, "lib", "libvips.node"))).resolves.toBeTruthy();
  });
});
