import type { NodeFileTraceOptions, NodeFileTraceResult } from "@vercel/nft";
import type { PackageJson } from "pkg-types";

export interface ExternalsPluginOptions {
  /**
   * The root directory to use when resolving files. Defaults to `process.cwd()`.
   */
  rootDir?: string;

  /**
   * Patterns to trace or externalize.
   */
  include?: (string | RegExp)[];

  /**
   * Patterns to exclude from tracing or externalizing (makes them to be bundled).
   */
  exclude?: (string | RegExp)[];

  /**
   *
   * Tracing options.
   *
   * If `false`, disables automatic tracing of `node_modules` dependencies and keeps them as absolute external paths.
   */
  trace?: boolean | ExternalsTraceOptions;

  /**
   * Patterns to force trace even if not resolved.
   */
  traceInclude?: string[];

  /**
   * Resolve conditions to use when resolving packages. Defaults to `["node", "import", "default"]`
   */
  conditions?: string[];
}

export interface ExternalsTraceOptions {
  /**
   * The root directory to use when resolving files. Defaults to `process.cwd()`.
   */
  rootDir?: string;

  /**
   * The output directory where traced files will be copied. Defaults to `dist`.
   */
  outDir?: string;

  /**
   * Options to pass to `@vercel/nft` for file tracing.
   *
   * @see https://github.com/vercel/nft#options
   */
  nft?: NodeFileTraceOptions;

  /**
   * Module resolution conditions to use when resolving packages.
   *
   * Defaults to `["node", "import", "default"]`
   */
  conditions?: string[];

  /**
   * Alias for module paths when tracing files.
   */
  traceAlias?: Record<string, string>;

  /**
   * Preserve file permissions when copying files. If set to `true`, original file permissions are preserved. If set to a number, that value is used as the permission mode (e.g., `0o755`).
   */
  chmod?: boolean | number;

  /**
   * If `true`, writes a `package.json` file to the output directory (parent) with the traced files as dependencies.
   */
  writePackageJson?: boolean;

  /**
   * Package names (or absolute paths) to force into the trace even when they are
   * not statically reachable from the input (e.g. native dependencies loaded
   * dynamically at runtime).
   *
   * Each name is resolved from the roots of traced packages that declare it as a
   * dependency (so the instance/version the dependent actually uses is picked,
   * including pnpm's non-hoisted nested layout), falling back to `rootDir` for
   * app-level deps that no traced package declares.
   */
  traceInclude?: string[];

  /**
   * Additional package roots to consider as declarers when resolving
   * {@link traceInclude} names.
   *
   * `traceInclude` names are normally resolved from the roots of *traced*
   * packages that declare them. A package that is bundled by the caller (rather
   * than externalized) never becomes a traced package, so a native dependency it
   * declares (e.g. `sharp` loaded dynamically) cannot be resolved from its real
   * location — and under pnpm it is not hoisted to `rootDir` either. Pass the
   * roots of such bundled packages here so their declared `traceInclude` names
   * resolve from the instance the dependent actually uses.
   *
   * Relative paths are resolved against {@link rootDir}.
   */
  traceIncludeRoots?: string[];

  /**
   * List of package names to include all files for in the trace (not just nft-detected ones).
   *
   * Each item can be a package name string or a tuple of `[packageName, { glob }]` to customize the glob pattern.
   *
   * Requires Node.js >= 22.0.0 (`fs.promises.glob`).
   *
   * @example
   * ```ts
   * fullTraceInclude: [
   *   "some-pkg",
   *   ["other-pkg", { glob: "dist/**" }],
   * ]
   * ```
   */
  fullTraceInclude?: (string | [name: string, options: { glob?: string }])[];

  /**
   * Hook functions for allow extending tracing behavior.
   */
  hooks?: TraceHooks;

  /** Transform traced files */
  transform?: Transformer[];
}

export type Transformer = {
  filter: (id: string) => boolean;
  handler: (code: string, id: string) => string | undefined | Promise<string | undefined>;
};

export type TracedFile = {
  path: string;
  subpath: string;
  parents: string[];
  pkgPath: string;
  pkgName: string;
  pkgVersion: string;
};

export type TracedPackage = {
  name: string;
  versions: Record<
    string,
    {
      pkgJSON: PackageJson;
      path: string;
      files: string[];
    }
  >;
};

/**
 * Final `node_modules` layout written by `traceNodeModules`.
 *
 * All output paths are relative to `outDir` and use forward slashes.
 */
export type TracedLayout = {
  /** Output layout of each traced package, keyed by package name. */
  packages: Record<string, TracedPackageLayout>;
  /**
   * Output path (relative to `outDir`) of each input file that lives in a traced
   * package, keyed by the input path as passed to `traceNodeModules`.
   *
   * @example { "/app/packages/a/node_modules/bcrypt/index.js": "node_modules/.nf3/bcrypt@2.0.0/index.js" }
   */
  files: Record<string, string>;
};

export type TracedPackageLayout = {
  name: string;
  /** Version reachable as `node_modules/<name>` (bare specifier). */
  hoisted: string;
  versions: Record<
    string,
    {
      /** Source package directory on disk (realpath). */
      path: string;
      /**
       * Output package directory relative to `outDir`, e.g. `node_modules/bcrypt`
       * or `node_modules/.nf3/bcrypt@1.0.0` when multiple versions are traced.
       */
      outPath: string;
      /** Whether this version is the one linked at `node_modules/<name>`. */
      hoisted: boolean;
    }
  >;
};

export interface TraceHooks {
  traceStart?: (files: string[]) => void | Promise<void>;
  traceResult?: (result: NodeFileTraceResult) => void | Promise<void>;
  tracedFiles?: (files: Record<string, TracedFile>) => void | Promise<void>;
  tracedPackages?: (packages: Record<string, TracedPackage>) => void | Promise<void>;
  /** Called with the final output layout once all packages are written. */
  tracedLayout?: (layout: TracedLayout) => void | Promise<void>;
}
