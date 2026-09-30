import { defineBuildConfig } from "obuild/config";

import { patchLibs } from "./build/patch-libs.ts";

import type { Plugin } from "rollup";

export default defineBuildConfig({
  entries: [
    {
      type: "bundle",
      input: ["src/index.ts", "src/plugin.ts", "src/db.ts"],
      minifyLibs: true,
      rolldown: {
        // Only used for types (`import type { Plugin } from "rollup"`)
        external: ["rollup"],
      },
    },
  ],
  hooks: {
    rolldownConfig: (config) => {
      config.plugins ??= [];
      (config.plugins as Plugin[]).push(patchLibs());
    },
    async end() {
      // obuild groups lib chunks by `/node_modules/` paths, so on Windows (`\`) they merge
      // into a single `libs/common` chunk; releases are never built on Windows
      if (process.platform === "win32") return;
      const fs = await import("node:fs");
      const path = await import("node:path");
      const expected = { bytes: 396_000, files: 19 };
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
