# 📦 nf3

<!-- automd:badges color=yellow codecov packagephobia -->

[![npm version](https://img.shields.io/npm/v/nf3?color=yellow)](https://npmjs.com/package/nf3)
[![npm downloads](https://img.shields.io/npm/dm/nf3?color=yellow)](https://npm.chart.dev/nf3)
[![install size](https://badgen.net/packagephobia/install/nf3?color=yellow)](https://packagephobia.com/result?p=nf3)
[![codecov](https://img.shields.io/codecov/c/gh/unjs/nf3?color=yellow)](https://codecov.io/gh/unjs/nf3)

<!-- /automd -->

This plugin traces and copies only the `node_modules` that are actually required at runtime for your built output — powered by [@vercel/nft](https://github.com/vercel/nft).

Bundling external dependencies can sometimes fail or cause issues, especially when modules rely on relative paths, native bindings, or dynamic imports.

To solve this, the plugin analyzes your build output, traces its runtime dependencies, and copies a **tree-shaken**, **deduplicated**, and **runtime-only** subset of `node_modules` into `dist/node_modules`.
The result is a minimal, self-contained distribution directory that just works.

Originally extracted from [Nitro](https://nitro.build) and used for optimizing `nf3` package dist itself!

## Usage

### Rollup/Rolldown plugin

```js
import { rollupNodeFileTrace } from "nf3";

export default {
  plugins: [
    rollupNodeFileTrace({
      // rootDir: process.cwd(),
      // outDir: "dist",
      // exportConditions: ["node", "import", "default"],
      // traceAlias: {},
      // chmod: true, // or 0o755
      // noTrace: false,
      // inline: [/^@my-scope\//],
      // external: ["fsevents"],
      // moduleDirectories: ["node_modules"],
      // traceInclude: ["some-lib"],
      // writePackageJson: true,
      // traceOptions: { /* see https://github.com/vercel/nft#options */ }
    }),
  ],
};
```

### API

```js
import { traceNodeModules } from "nf3";

await traceNodeModules(["./index.mjs"], {
  /* options */
});
```

## Development

<details>

<summary>local development</summary>

- Clone this repository
- Install latest LTS version of [Node.js](https://nodejs.org/en/)
- Enable [Corepack](https://github.com/nodejs/corepack) using `corepack enable`
- Install dependencies using `pnpm install`
- Run interactive tests using `pnpm dev`

</details>

## License

Published under the [MIT](https://github.com/unjs/nf3/blob/main/LICENSE) license.
