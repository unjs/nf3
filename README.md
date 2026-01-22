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

### API

```js
import { traceNodeModules } from "nf3";

await traceNodeModules(["./index.mjs"], {
  //   outDir: "dist",
  // chmod: 0o755,
  // writePackageJson: true,
  // traceAlias: {},
  // hooks: {},
  // nft: {}, // https://github.com/vercel/nft#options
});
```

### Rollup/Rolldown/Vite Plugin

```js
import { externals } from "nf3/plugin";

export default {
  plugins: [
    externals({
      // rootDir: ".",
      // conditions: ["node", "import", "default"],
      // include: [/^@my-scope\//],
      // exclude: ["fsevents"],
      // traceInclude: ["some-lib"],
      // trace: {}
    }),
  ],
};
```

### Hooks

After the Rollup plugin traces the required files, `traceNodeModules` processes them into an optimized `node_modules` output.

Each phase can be extended through hooks:

```js
rollupNodeFileTrace({
  hooks: {
    traceStart: (files) => {},
    traceResult: (result) => {},
    tracedFiles: (files) => {},
    tracedPackages: (packages) => {},
  },
});
```

### Transforming

Before writing files, you can transform some of them.

**Example:**

```js
import { minify } from "oxc-minify";

rollupNodeFileTrace({
  transform: [
    {
      filter: (id) => /\.[mc]?js$/.test(id),
      handler: (code, id) => minify(id, code, {}).code,
    },
  ],
});
```

## Packages DB

NF3 exports a list of known packages that include native code and require platform-specific builds.

These packages cannot be bundled and should be traced as external dependencies most of the time and often need tracing.

```js
import { NodeNativePackages } from "nf3/db";
```

NF3 also exports a list of packages that must be externalized rather than bundled, due to bundler compatibility issues with their module format or dynamic imports.

```js
import { NonBundleablePackages } from "nf3/db";
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
