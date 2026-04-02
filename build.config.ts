import { defineBuildConfig } from "obuild/config";
import { minifySync } from "oxc-minify";

import { externals } from "./src/plugin.ts";

import type { Plugin } from "rollup";

export default defineBuildConfig({
  entries: [
    {
      type: "bundle",
      input: ["src/index.ts", "src/plugin.ts", "src/db.ts"],
    },
  ],
  hooks: {
    rolldownConfig: (config) => {
      config.plugins ??= [];
      (config.plugins as Plugin[]).push(
        externals({
          exclude: [/pkg-types|confbox|exsolve|pathe/],
          trace: {
            transform: [
              {
                filter: (id) => /\.[mc]?js$/.test(id),
                handler: (code, id) => minifySync(id, code, {}).code,
              },
            ],
            hooks: {
              tracedPackages(pkgs) {
                // prettier-ignore
                const ignorePkgs = [
                  "agent-base", "chownr", "debug", "fsevents", "has-flag", "https-proxy-agent",
                  "minizlib", "ms", "node-fetch", "supports-color", "tar", "tr46",
                  "webidl-conversions", "whatwg-url", "yallist" , "rollup", "typescript"
                ];
                for (const name of Object.keys(pkgs)) {
                  if (ignorePkgs.includes(name) || name.startsWith("@rollup/rollup-")) {
                    delete pkgs[name];
                  }
                }
                // prettier-ignore
                const essentialFields = new Set([
                  "name", "version", "type",
                  "main", "exports", "imports"
                ]);
                for (const pkgGroup of Object.values(pkgs)) {
                  for (const pkg of Object.values(pkgGroup.versions)) {
                    pkg.pkgJSON = Object.fromEntries(
                      Object.entries(pkg.pkgJSON).filter(([key]) => essentialFields.has(key)),
                    );
                  }
                }
              },
            },
          },
        }),
        {
          name: "min-libs",
          renderChunk(code, chunk) {
            if (chunk.fileName.startsWith("_chunks/libs/")) {
              return minifySync(chunk.fileName, code, {});
            }
          },
        },
      );
    },
    async end() {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const expected = { bytes: 550_000, files: 155 };
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
