import { defineBuildConfig } from "obuild/config";
import { rollupNodeFileTrace } from "./src/plugin.ts";
import { fileURLToPath } from "node:url";
import { minifySync } from "oxc-minify";
import { parseNodeModulePath } from "mlly";

import type { Plugin } from "rollup";

export default defineBuildConfig({
  entries: ["src/index.ts"],
  hooks: {
    rolldownConfig: (config) => {
      config.resolve ??= {};
      config.resolve.alias ??= {};
      config.resolve.alias["@vercel/nft"] = fileURLToPath(
        import.meta.resolve("@vercel/nft"),
      );
      config.plugins ??= [];
      (config.plugins as Plugin[]).push(
        rollupNodeFileTrace({
          outDir: "dist",
          exportConditions: ["node", "import", "default"],
          external: ["semver"],
          transform: [
            {
              filter: (id) => /\.[mc]?js$/.test(id),
              handler: (code, id) => minifySync(id, code, {}).code,
            },
          ],
          hooks: {
            tracedPackages(pkgs) {
              const ignorePkgs = [
                "agent-base",
                "chownr",
                "debug",
                "has-flag",
                "https-proxy-agent",
                "@isaacs",
                "minizlib",
                "ms",
                "node-fetch",
                "supports-color",
                "tar",
                "tr46",
                "webidl-conversions",
                "whatwg-url",
                "yallist",
              ];
              for (const pkg of ignorePkgs) {
                delete pkgs[pkg];
              }
              const essentialFields = new Set([
                "name",
                "version",
                "type",
                "main",
                "exports",
                "imports",
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
          inline: [
            "mlly",
            "pkg-types",
            "confbox",
            "exsolve",
            "pathe",
            "ufo",
            "semver",
          ],
        }),
        {
          name: "min-libs",
          renderChunk(code, chunk) {
            if (chunk.fileName.startsWith("_libs/")) {
              return minifySync(chunk.fileName, code, {});
            }
          },
        },
      );
    },
    rolldownOutput(config) {
      config.chunkFileNames = "[name].mjs";
      config.advancedChunks ||= {};
      config.advancedChunks.groups = [
        {
          test: /node_modules/,
          name: (moduleId) => {
            const pkgName = parseNodeModulePath(moduleId)
              ?.name?.split("/")
              .pop();
            return `_libs/${pkgName || "_common"}`;
          },
        },
      ];
    },
  },
});
