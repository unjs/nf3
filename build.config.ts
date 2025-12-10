import { defineBuildConfig } from "obuild/config";
import { minifySync } from "oxc-minify";

import { externals } from "./src/plugin.ts";

import type { Plugin } from "rollup";

export default defineBuildConfig({
  entries: [
    {
      type: "bundle",
      input: ["src/index.ts", "src/plugin.ts"],
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
                  "agent-base", "chownr", "debug", "has-flag", "https-proxy-agent",
                  "minizlib", "ms", "node-fetch", "supports-color", "tar", "tr46",
                  "webidl-conversions", "whatwg-url", "yallist" , "rollup"
                ];
                for (const pkg of ignorePkgs) {
                  delete pkgs[pkg];
                }
                // prettier-ignore
                const essentialFields = new Set([
                  "name", "version", "type",
                  "main", "exports", "imports"
                ]);
                for (const pkgGroup of Object.values(pkgs)) {
                  for (const pkg of Object.values(pkgGroup.versions)) {
                    pkg.pkgJSON = Object.fromEntries(
                      Object.entries(pkg.pkgJSON).filter(([key]) =>
                        essentialFields.has(key),
                      ),
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
  },
});
