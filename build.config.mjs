import { defineBuildConfig } from "obuild/config";
import { rollupNodeFileTrace } from "./src/plugin.ts";
import { fileURLToPath } from "node:url";
import { minify } from "oxc-minify";

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
      config.plugins.push(
        rollupNodeFileTrace({
          outDir: "dist",
          exportConditions: ["node", "import", "default"],
          transform: [
            {
              filter: (id) => /\.m?js$/.test(id),
              handler: async (code, id) => {
                try {
                  return minify(id, code, {}).code;
                } catch (error) {
                  console.error(
                    new Error(`Minification failed for ${id}`, {
                      cause: error,
                    }),
                  );
                }
              },
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
      );
    },
  },
});
