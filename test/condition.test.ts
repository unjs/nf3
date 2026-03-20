import { describe, expect, it } from "vitest";
import { applyProductionCondition } from "../src/trace.ts";

describe("externals:applyProductionCondition", () => {
  const applyProductionConditionCases = [
    {
      name: "vue-router@4.1.6",
      in: {
        ".": {
          types: "./dist/vue-router.d.ts",
          node: {
            import: {
              production: "./dist/vue-router.node.mjs",
              development: "./dist/vue-router.node.mjs",
              default: "./dist/vue-router.node.mjs",
            },
            require: {
              production: "./dist/vue-router.prod.cjs",
              development: "./dist/vue-router.cjs",
              default: "./index.js",
            },
          },
          import: "./dist/vue-router.mjs",
          require: "./index.js",
        },
        "./dist/*": "./dist/*",
        "./vetur/*": "./vetur/*",
        "./package.json": "./package.json",
      },
      out: {
        ".": {
          types: "./dist/vue-router.d.ts",
          node: {
            import: {
              production: "./dist/vue-router.node.mjs",
              development: "./dist/vue-router.node.mjs",
              default: "./dist/vue-router.node.mjs",
            },
            require: {
              production: "./dist/vue-router.prod.cjs",
              development: "./dist/vue-router.cjs",
              default: "./dist/vue-router.prod.cjs",
            },
          },
          import: "./dist/vue-router.mjs",
          require: "./index.js",
        },
        "./dist/*": "./dist/*",
        "./vetur/*": "./vetur/*",
        "./package.json": "./package.json",
      },
    },
    {
      name: "fluent-vue@3.2.0",
      in: {
        ".": {
          production: {
            require: "./dist/prod/index.cjs",
            import: "./dist/prod/index.mjs",
          },
          types: "./index.d.ts",
          require: "./dist/index.cjs",
          import: "./dist/index.mjs",
        },
      },
      out: {
        ".": {
          production: {
            require: "./dist/prod/index.cjs",
            import: "./dist/prod/index.mjs",
          },
          types: "./index.d.ts",
          require: "./dist/prod/index.cjs",
          import: "./dist/prod/index.mjs",
        },
      },
    },
  ];
  it("should not double-process production via shared references", () => {
    const input = {
      ".": {
        production: {
          import: "./dist/prod.mjs",
          require: "./dist/prod.cjs",
        },
        import: "./dist/dev.mjs",
        require: "./dist/dev.cjs",
      },
    };
    applyProductionCondition(input as any);
    const result = JSON.parse(JSON.stringify(input));
    // Apply again to verify idempotency
    applyProductionCondition(input as any);
    expect(input).toEqual(result);
  });

  it("should not mutate original production value via shared reference", () => {
    const input = {
      ".": {
        production: {
          node: { import: "./dist/prod.mjs", default: "./dist/prod-default.mjs" },
        },
        node: { import: "./dist/dev.mjs", default: "./dist/dev-default.mjs" },
      },
    };
    applyProductionCondition(input as any);
    // The original production.node should not be mutated by recursion
    expect((input as any)["."].production.node).toEqual({
      import: "./dist/prod.mjs",
      default: "./dist/prod-default.mjs",
    });
  });

  for (const t of applyProductionConditionCases) {
    it(t.name, () => {
      applyProductionCondition(t.in as any);
      expect(t.in).toEqual(t.out);
    });
  }
});
