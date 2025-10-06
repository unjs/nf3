import { defineBuildConfig } from "obuild/config";
import { rollupNodeFileTrace } from "./src/plugin.ts";
import { fileURLToPath } from "node:url";

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
