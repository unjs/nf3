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
