import { defineConfig } from "vitest/config";

console.log("vitest.config.mjs loaded");
export default defineConfig({
  server: {
    watch: {
      ignored: ["**/dist/**"],
    },
  },
});
