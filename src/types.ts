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
   * Hook functions for allow extending tracing behavior.
   */
  hooks?: TraceHooks;

  /** Transform traced files */
  transform?: Transformer[];
}

export type Transformer = {
  filter: (id: string) => boolean;
  handler: (
    code: string,
    id: string,
  ) => string | undefined | Promise<string | undefined>;
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

export interface TraceHooks {
  traceStart?: (files: string[]) => void | Promise<void>;
  traceResult?: (result: NodeFileTraceResult) => void | Promise<void>;
  tracedFiles?: (files: Record<string, TracedFile>) => void | Promise<void>;
  tracedPackages?: (
    packages: Record<string, TracedPackage>,
  ) => void | Promise<void>;
}
