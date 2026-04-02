import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    watch: {
      ignored: ["**/dist/**"],
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
