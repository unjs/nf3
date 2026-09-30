import { defineBuildConfig } from "obuild/config";
import { minifySync } from "oxc-minify";

import { patchLibs } from "./build/patch-libs.ts";

import type { Plugin } from "rollup";

export default defineBuildConfig({
  entries: [
    {
      type: "bundle",
      input: ["src/index.ts", "src/plugin.ts", "src/db.ts"],
      rolldown: {
        // Only used for types (`import type { Plugin } from "rollup"`)
        external: ["rollup"],
      },
    },
  ],
  hooks: {
    rolldownConfig: (config) => {
      config.plugins ??= [];
      (config.plugins as Plugin[]).push(patchLibs(), {
        // Runs after rolldown's own "dce-only" minify pass (which reprints renderChunk output)
        name: "min-libs",
        generateBundle(_, bundle) {
          for (const chunk of Object.values(bundle)) {
            if (chunk.type === "chunk" && chunk.fileName.startsWith("_chunks/libs/")) {
              chunk.code = minifySync(chunk.fileName, chunk.code, {}).code;
            }
          }
        },
      });
    },
    async end() {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const expected = { bytes: 385_000, files: 19 };
      const tolerance = 0.05;
      let totalBytes = 0;
      let totalFiles = 0;
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(p);
          else if (entry.isFile()) {
            totalBytes += fs.statSync(p).size;
            totalFiles++;
          }
        }
      };
      walk("dist");
      const checkLimit = (label: string, actual: number, baseline: number) => {
        const max = Math.round(baseline * (1 + tolerance));
        const min = Math.round(baseline * (1 - tolerance));
        if (actual > max || actual < min) {
          throw new Error(
            `dist ${label} regression: ${actual} (expected ${min}–${max}, baseline ${baseline})`,
          );
        }
      };
      checkLimit("size", totalBytes, expected.bytes);
      checkLimit("file count", totalFiles, expected.files);
      console.log(`✓ dist size: ${(totalBytes / 1024).toFixed(0)} kB (${totalFiles} files)`);
    },
  },
});
