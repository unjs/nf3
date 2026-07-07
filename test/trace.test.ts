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
