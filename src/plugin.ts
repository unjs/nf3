import { pathToFileURL } from "node:url";
import { builtinModules } from "node:module";
import { isAbsolute, resolve } from "pathe";
import { resolveModulePath } from "exsolve";
import { guessSubpath, toImport, pathRegExp, toPathRegExp } from "./_utils.ts";
import { DEFAULT_CONDITIONS } from "./trace.ts";

import type { Plugin } from "rollup";
import type { ExternalsPluginOptions } from "./types.ts";
export type { ExternalsPluginOptions } from "./types.ts";

const PLUGIN_NAME = "nitro:externals";

export function externals(opts: ExternalsPluginOptions): Plugin {
  const rootDir = resolve(opts.rootDir || ".");

  const include: RegExp[] | undefined = opts?.include
    ? opts.include.map((p) => toPathRegExp(p))
    : undefined;

  const exclude: RegExp[] = [
    /^(?:[\0#~.]|[a-z0-9]{2,}:)|\?/,
    new RegExp("^" + pathRegExp(rootDir) + "(?!.*node_modules)"),
    ...(opts?.exclude || []).map((p) => toPathRegExp(p)),
  ];

  const filter = (id: string) => {
    // Most match at least one include (if specified)
    if (include && !include.some((r) => r.test(id))) {
      return false;
    }
    // Most not match any exclude
    if (exclude.some((r) => r.test(id))) {
      return false;
    }
    return true;
  };

  const tryResolve = (id: string, from: string | undefined) =>
    resolveModulePath(id, {
      try: true,
      from: from && isAbsolute(from) ? from : rootDir,
      conditions: opts.conditions,
    });

  const tracedPaths = new Set<string>();

  return {
    name: PLUGIN_NAME,
    resolveId: {
      order: "pre",
      filter: { id: { exclude, include } },
      async handler(id, importer, rOpts) {
        // Externalize built-in modules with normalized prefix
        if (builtinModules.includes(id)) {
          return {
            resolvedBy: PLUGIN_NAME,
            external: true,
            id: id.includes(":") ? id : `node:${id}`,
          };
        }

        // Skip nested rollup-node resolutions
        if (rOpts.custom?.["node-resolve"]) {
          return null;
        }

        // Resolve by other resolvers
        let resolved = await this.resolve(id, importer, rOpts);

        // Skip rolldown-plugin-commonjs resolver for externals
        const cjsResolved = resolved?.meta?.commonjs?.resolved;
        if (cjsResolved) {
          if (!filter(cjsResolved.id)) {
            return resolved; // Bundled and wrapped by CJS plugin
          }
          resolved = cjsResolved /* non-wrapped */;
        }

        // Check if not resolved or explicitly marked as excluded
        if (!resolved?.id || !filter(resolved!.id)) {
          return resolved;
        }

        // Normalize to absolute path
        let resolvedPath = resolved.id;
        if (!isAbsolute(resolvedPath)) {
          resolvedPath = tryResolve(resolvedPath, importer) || resolvedPath;
        }

        // Tracing mode
        if (opts.trace !== false) {
          let importId = toImport(id) || toImport(resolvedPath);
          if (!importId) {
            return resolved;
          }
          if (!tryResolve(importId, importer)) {
            const guessed = await guessSubpath(
              resolvedPath,
              opts.conditions || DEFAULT_CONDITIONS,
            );
            if (!guessed) {
              return resolved;
            }
            importId = guessed;
          }
          tracedPaths.add(resolvedPath);
          return {
            ...resolved,
            resolvedBy: PLUGIN_NAME,
            external: true,
            id: importId,
          };
        }

        // Resolve as absolute path external
        return {
          ...resolved,
          resolvedBy: PLUGIN_NAME,
          external: true,
          id: isAbsolute(resolvedPath)
            ? pathToFileURL(resolvedPath).href // windows compat
            : resolvedPath,
        };
      },
    },
    buildEnd: {
      order: "post",
      async handler() {
        if (opts.trace === false || tracedPaths.size === 0) {
          return;
        }
        const { traceNodeModules } = await import("./trace.ts");
        await traceNodeModules([...tracedPaths], {
          conditions: opts.conditions,
          rootDir,
          ...(opts.trace === true ? {} : opts.trace),
        });
      },
    },
  };
}
