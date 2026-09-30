import { defineBuildConfig } from "obuild/config";
import { minifySync } from "oxc-minify";

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
      (config.plugins as Plugin[]).push(
        {
          // Patch CJS-only constructs in bundled dependencies
          name: "patch-libs",
          transform(code, id) {
            // @vercel/nft nbind locator uses `eval('require.resolve(...)')` to hide
            // `require` from bundlers, but `require` is not in scope in ESM output
            if (/[/\\]@vercel[/\\]nft[/\\]out[/\\]utils[/\\]binary-locators\.js$/.test(id)) {
              return code.replace(/eval\('require\.resolve\((\w+)\)'\)/g, "require.resolve($1)");
            }
          },
        },
        {
          // Runs after rolldown's own "dce-only" minify pass (which reprints renderChunk output)
          name: "min-libs",
          generateBundle(_, bundle) {
            for (const chunk of Object.values(bundle)) {
              if (chunk.type === "chunk" && chunk.fileName.startsWith("_chunks/libs/")) {
                chunk.code = minifySync(chunk.fileName, chunk.code, {}).code;
              }
            }
          },
        },
      );
    },
    async end() {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const expected = { bytes: 530_000, files: 18 };
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
