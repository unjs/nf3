import type { Plugin } from "rollup";
import type { ExternalsPluginOptions } from "./types.ts";

import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stat } from "node:fs/promises";
import { resolveModuleURL } from "exsolve";
import { isAbsolute, join, normalize, resolve } from "pathe";
import {
  isValidNodeImport,
  lookupNodeModuleSubpath,
  normalizeid,
  parseNodeModulePath,
} from "mlly";

import { traceNodeModules } from "./trace.ts";

export function rollupNodeFileTrace(opts: ExternalsPluginOptions = {}): Plugin {
  const trackedExternals = new Set<string>();

  const moduleDirectories = opts.moduleDirectories || [
    resolve(opts.rootDir || ".", "node_modules") + "/",
  ];

  const tryResolve = (
    id: string,
    importer: undefined | string,
  ): string | undefined => {
    if (id.startsWith("\0")) {
      return id;
    }
    const res = resolveModuleURL(id, {
      try: true,
      conditions: opts.exportConditions,
      from:
        importer && isAbsolute(importer)
          ? [pathToFileURL(importer), ...moduleDirectories]
          : moduleDirectories,
      suffixes: ["", "/index"],
      extensions: [".mjs", ".cjs", ".js", ".mts", ".cts", ".ts", ".json"],
    });
    return res?.startsWith("file://") ? fileURLToPath(res) : res;
  };

  // Normalize options
  const inlineMatchers = (opts.inline || [])
    .map((p) => normalizeMatcher(p))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  const externalMatchers = (opts.external || [])
    .map((p) => normalizeMatcher(p))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  // Utility to check explicit inlines
  const isExplicitInline = (id: string, importer?: string) => {
    if (id.startsWith("\0")) {
      return true;
    }
    const inlineMatch = inlineMatchers.find((m) => m(id, importer));
    const externalMatch = externalMatchers.find((m) => m(id, importer));
    if (
      inlineMatch &&
      (!externalMatch ||
        (externalMatch &&
          (inlineMatch.score || 0) > (externalMatch.score || 0)))
    ) {
      return true;
    }
  };

  return {
    name: "nf3",

    resolveId: {
      order: "pre",
      // TODO
      // filter: { id: { exclude: [] } },
      async handler(originalId, importer, options) {
        // Skip internals
        if (
          !originalId ||
          originalId.startsWith("\u0000") ||
          originalId.includes("?") ||
          originalId.startsWith("#")
        ) {
          return null;
        }

        // Skip relative paths
        if (originalId.startsWith(".")) {
          return null;
        }

        // Normalize path (windows)
        const id = normalize(originalId);

        // Check for explicit inline and externals
        if (isExplicitInline(id, importer)) {
          return null;
        }

        // Resolve id using rollup resolver
        const resolved = (await this.resolve(
          originalId,
          importer,
          options,
        )) || {
          id,
        };

        // Check for explicit inlines and externals
        if (isExplicitInline(resolved.id, importer)) {
          return null;
        }

        // Try resolving with Node.js algorithm as fallback
        if (
          !isAbsolute(resolved.id) ||
          !existsSync(resolved.id) ||
          (await isDirectory(resolved.id))
        ) {
          resolved.id = tryResolve(resolved.id, importer) || resolved.id;
        }

        // Inline invalid node imports
        if (!(await isValidNodeImport(resolved.id).catch(() => false))) {
          return null;
        }

        // Externalize with full path if trace is disabled
        if (opts.noTrace) {
          return {
            ...resolved,
            id: isAbsolute(resolved.id)
              ? normalizeid(resolved.id)
              : resolved.id,
            external: true,
          };
        }

        // -- Trace externals --

        // Try to extract package name from path
        const { name: pkgName } = parseNodeModulePath(resolved.id);

        // Inline if cannot detect package name
        if (!pkgName) {
          return null;
        }

        // Normally package name should be same as originalId
        // Edge cases: Subpath export and full paths
        if (pkgName !== originalId) {
          // Subpath export
          if (!isAbsolute(originalId)) {
            const fullPath = tryResolve(originalId, importer);
            if (fullPath) {
              trackedExternals.add(fullPath);
              return {
                id: originalId,
                external: true,
              };
            }
          }

          // Absolute path, we are not sure about subpath to generate import statement
          // Guess as main subpath export
          const packageEntry = tryResolve(pkgName, importer);
          if (packageEntry !== id) {
            // Reverse engineer subpath export
            const guessedSubpath: string | null | undefined =
              await lookupNodeModuleSubpath(id).catch(() => null);
            const resolvedGuess =
              guessedSubpath &&
              tryResolve(join(pkgName, guessedSubpath), importer);
            if (resolvedGuess === id) {
              trackedExternals.add(resolvedGuess);
              return {
                id: join(pkgName, guessedSubpath!),
                external: true,
              };
            }
            // Inline since we cannot guess subpath
            return null;
          }
        }

        trackedExternals.add(resolved.id);
        return {
          id: pkgName,
          external: true,
        };
      },
    },

    buildEnd: {
      order: "post",
      async handler() {
        if (opts.noTrace) {
          return;
        }
        for (const pkgName of opts.traceInclude || []) {
          const path = await this.resolve(pkgName);
          if (path?.id) {
            trackedExternals.add(path.id.replace(/\?.+/, ""));
          }
        }
        await traceNodeModules([...trackedExternals], opts);
      },
    },
  };
}

type Matcher = ((
  id: string,
  importer?: string,
) => Promise<boolean> | boolean) & { score?: number };

function normalizeMatcher(input: string | RegExp | Matcher): Matcher {
  if (typeof input === "function") {
    input.score = input.score ?? 10_000;
    return input;
  }

  if (input instanceof RegExp) {
    const matcher = ((id: string) => input.test(id)) as Matcher;
    matcher.score = input.toString().length;
    Object.defineProperty(matcher, "name", { value: `match(${input})` });
    return matcher;
  }

  if (typeof input === "string") {
    const pattern = normalize(input);
    const matcher = ((id: string) => {
      const idWithoutNodeModules = id.split("node_modules/").pop();
      return (
        id.startsWith(pattern) || idWithoutNodeModules?.startsWith(pattern)
      );
    }) as Matcher;
    matcher.score = input.length;

    // Increase score for npm package names to avoid breaking changes
    // TODO: Remove in next major version
    if (!isAbsolute(input) && input[0] !== ".") {
      matcher.score += 1000;
    }

    Object.defineProperty(matcher, "name", { value: `match(${pattern})` });
    return matcher;
  }

  throw new Error(`Invalid matcher or pattern: ${input}`);
}

async function isDirectory(path: string) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}
