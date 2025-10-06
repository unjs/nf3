import { describe, expect, it } from "vitest";
import { traceNodeModules } from "../src/index.ts";
import { fileURLToPath } from "node:url";
import { cp } from "node:fs/promises";
import path from "node:path";
import { readFile } from "node:fs/promises";

describe("traceNodeModules", () => {
  it("traceNodeModules", async () => {
    const input = fileURLToPath(new URL("fixture/index.mjs", import.meta.url));
    const outDir = fileURLToPath(new URL("dist/trace", import.meta.url));

    await cp(input, `${outDir}/index.mjs`);
    await traceNodeModules([input], { outDir });

    const entry = await import(`${outDir}/index.mjs`);

    expect(entry.default).toMatchObject({
      depA: "@fixture/nitro-lib@1.0.0+@fixture/nested-lib@1.0.0",
      depB: "@fixture/nitro-lib@2.0.1+@fixture/nested-lib@2.0.1",
      depLib: "@fixture/nitro-lib@2.0.0+@fixture/nested-lib@2.0.0",
      extraUtils: "@fixture/nitro-utils/extra",
      subpathLib: "@fixture/nitro-lib@2.0.0",
    });
  });

  it.only("traceNodeModules with fullTraceInclude", async () => {
    const input = fileURLToPath(new URL("fixture/index.mjs", import.meta.url));
    const outDir = fileURLToPath(new URL("dist/trace", import.meta.url));

    await cp(input, `${outDir}/index.mjs`);
    await traceNodeModules([input], { outDir, fullTraceInclude: true });

    expect(
      await readFile(
        path.join(
          outDir,
          "node_modules",
          "@fixture",
          "nitro-utils",
          "README.md",
        ),
        { encoding: "utf8" },
      ),
    ).toMatch("# TEST");
  });
});
