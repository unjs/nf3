import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const distDir = fileURLToPath(new URL("dist/", import.meta.url)).replaceAll("\\", "/");

export default defineConfig({
  server: {
    watch: {
      ignored: ["**/dist/**"],
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    server: {
      deps: {
        // Load the built bundle (`test/dist.test.ts`) with the native Node.js loader:
        // Vitest's module runner puts `require` in scope, hiding ESM-only issues
        external: [new RegExp(`^${distDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)],
      },
    },
  },
});
