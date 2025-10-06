import type { NodeFileTraceOptions } from "@vercel/nft";

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
}

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
