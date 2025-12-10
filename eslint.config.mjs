import unjs from "eslint-config-unjs";

export default unjs({
  ignores: ["**/dist/**"],
  rules: {
    "unicorn/no-null": "off",
    "eslint/no-control-regex": "off",
  },
  markdown: {
    rules: {},
  },
});
