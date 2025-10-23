import { describe, it } from "vitest";
import { rollupNodeFileTrace } from "../src/index.ts";
import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";
import * as rolldown from "rolldown";
import * as rollup from "rollup";
import esbuild from "rollup-plugin-esbuild";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { rm } from "node:fs/promises";

describe("plugin", () => {
  const pkgDir = fileURLToPath(new URL("../", import.meta.url));
  const input = fileURLToPath(new URL("../src/index.ts", import.meta.url));

  it("rollup", async () => {
    await rm(fileURLToPath(new URL("dist/rollup", import.meta.url)), {
      recursive: true,
      force: true,
    });

    const out = await rollup.rollup({
      input,
      output: { format: "esm" },
      external: [...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
      plugins: [
        rollupNodeFileTrace({ rootDir: pkgDir }),
        nodeResolve({}),
        esbuild(),
      ],
    });
    await out.write({
      dir: fileURLToPath(new URL("dist/rollup", import.meta.url)),
    });
  });

  it("rolldown", async () => {
    await rm(fileURLToPath(new URL("dist/rolldown", import.meta.url)), {
      recursive: true,
      force: true,
    });

    await rolldown.build({
      input,
      output: {
        dir: fileURLToPath(new URL("dist/rolldown", import.meta.url)),
        format: "esm",
      },
      external: [...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
      plugins: [rollupNodeFileTrace({ rootDir: pkgDir })],
    });
  });
});
