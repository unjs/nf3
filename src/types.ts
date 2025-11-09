import type { NodeFileTraceOptions, NodeFileTraceResult } from "@vercel/nft";
import type { PackageJson } from "pkg-types";

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
  traceOptions?: NodeFileTraceOptions;

  /**
   * Module resolution conditions to use when resolving packages.
   *
   * Defaults to `["node", "import", "default"]`
   */
  exportConditions?: string[];

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
  handler: (code: string, id: string) => string | Promise<string>;
};

export interface ExternalsPluginOptions extends ExternalsTraceOptions {
  /**
   * If `true`, disables automatic tracing of `node_modules` dependencies and keeps them as absolute external paths.
   */
  noTrace?: boolean;

  /**
   * Patterns to always include (inline) instead of tracing them as externals.
   */
  inline?: Array<
    | string
    | RegExp
    | ((id: string, importer?: string) => Promise<boolean> | boolean)
  >;

  /**
   * Patterns to always exclude (trace) instead of inlining them as externals.
   */
  external?: Array<
    | string
    | RegExp
    | ((id: string, importer?: string) => Promise<boolean> | boolean)
  >;

  /**
   * `node_modules` directories to use when resolving packages. Defaults to `['node_modules']`.
   */
  moduleDirectories?: string[];

  /**
   * Patterns to always include (trace) even if not resolved.
   */
  traceInclude?: string[];
}

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
  traceStart: (files: string[]) => Promise<void>;
  traceResult: (result: NodeFileTraceResult) => Promise<void>;
  tracedFiles: (files: Record<string, TracedFile>) => Promise<void>;
  tracedPackages: (packages: Record<string, TracedPackage>) => Promise<void>;
}
