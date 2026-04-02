#!/usr/bin/env bun

/**
 * Traces NodeNativePackages using traceNodeModules to verify they can be
 * traced and imported correctly.
 *
 * For each package:
 * 1. Installs it in an isolated directory
 * 2. Creates a minimal entry file that imports the package
 * 3. Runs traceNodeModules against the entry
 * 4. Verifies the traced output can be resolved
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { NodeNativePackages, FullTracePackages } from "../src/db.ts";
import { traceNodeModules } from "../src/trace.ts";

// ANSI colors
const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

const { positionals } = parseArgs({
  allowPositionals: true,
});

const BUN = join(process.env.HOME!, ".bun/bin/bun");
const rootDir = resolve(fileURLToPath(import.meta.url), "../..");
const baseDir = join(rootDir, "scripts/.trace");

// Packages that cannot be compiled in standard environments
// (deprecated, platform-restricted, or require unavailable system libs)
const SkipPackages = [
  "ibm_db", // Rejects ARM64 Linux
  "hiredis", // Deprecated, incompatible with Node 22 V8 API
  "node-rdkafka", // Requires librdkafka (not in Debian repos)
  "ffi-napi", // Incompatible with Node 22 NAPI
  "nodegit", // Bundled gyp rejects Python 3
];

// Filter packages if positional args provided, otherwise use full list
const packages = positionals.length
  ? [
      ...new Set([
        ...NodeNativePackages.filter((p) =>
          positionals.some((f) => p === f || p.startsWith(f + "/")),
        ),
        // Include args not matching any built-in package as-is
        ...positionals.filter(
          (f) => !NodeNativePackages.some((p) => p === f || p.startsWith(f + "/")),
        ),
      ]),
    ]
  : NodeNativePackages.filter((p) => !SkipPackages.some((s) => p === s || p.startsWith(s + "/")));

if (packages.length === 0) {
  console.error("No matching packages found.");
  process.exit(1);
}

// Dedupe subpath exports to base package name
const installPackages = [
  ...new Set(
    packages.map((p) => {
      if (p.startsWith("@")) {
        return p.split("/").slice(0, 2).join("/");
      }
      return p.split("/")[0]!;
    }),
  ),
];

console.log(`Found ${packages.length} packages (${installPackages.length} unique to install)\n`);

mkdirSync(baseDir, { recursive: true });

interface TraceResult {
  pkg: string;
  status: "ok" | "install-failed" | "trace-failed" | "import-failed" | "source-failed";
  tracedPackages?: string[];
  error?: string;
}

async function tracePkg(pkg: string): Promise<TraceResult> {
  const safeName = pkg.replace(/[/@]/g, "_");
  const pkgDir = join(baseDir, safeName);

  // Setup isolated directory
  rmSync(pkgDir, { recursive: true, force: true });
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ type: "module" }));

  // Install
  const installName = pkg.startsWith("@")
    ? pkg.split("/").slice(0, 2).join("/")
    : pkg.split("/")[0]!;

  try {
    execSync(`${BUN} add --no-save ${installName}`, {
      cwd: pkgDir,
      timeout: 120_000,
      stdio: "pipe",
    });
  } catch {
    return { pkg, status: "install-failed" };
  }

  // Create entry file that imports the package
  const entryPath = join(pkgDir, "entry.mjs");
  writeFileSync(entryPath, `import ${JSON.stringify(pkg)};\n`);

  // Trace
  const outDir = join(pkgDir, "dist");
  let tracedPkgNames: string[] = [];
  try {
    await traceNodeModules([entryPath], {
      rootDir: pkgDir,
      outDir: "dist",
      writePackageJson: true,
      fullTraceInclude: [...FullTracePackages],
      hooks: {
        tracedPackages(packages) {
          tracedPkgNames = Object.keys(packages);
        },
      },
    });
  } catch (err: any) {
    return { pkg, status: "trace-failed", error: err.message };
  }

  // Hide source node_modules so validation only sees traced output
  const srcNm = join(pkgDir, "node_modules");
  const srcNmRenamed = join(pkgDir, "_node_modules");
  if (existsSync(srcNm)) {
    renameSync(srcNm, srcNmRenamed);
  }

  // Verify: actually import the package from within the traced output
  const verifyEntry = join(outDir, "_verify.mjs");
  writeFileSync(verifyEntry, `import ${JSON.stringify(pkg)};\n`);
  writeFileSync(join(outDir, "package.json"), JSON.stringify({ type: "module" }));

  try {
    execSync(`node ${verifyEntry}`, {
      cwd: outDir,
      timeout: 30_000,
      stdio: "pipe",
    });
  } catch (err: any) {
    const errMsg = err.stderr?.toString().split("\n")[0] || err.message;

    // Post-trace import failed — check if source node_modules works
    if (existsSync(srcNmRenamed)) {
      renameSync(srcNmRenamed, srcNm);
    }
    try {
      execSync(`node ${entryPath}`, {
        cwd: pkgDir,
        timeout: 30_000,
        stdio: "pipe",
      });
    } catch {
      // Source also fails — not a tracing issue, just a broken install
      return {
        pkg,
        status: "source-failed",
        tracedPackages: tracedPkgNames,
        error: errMsg,
      };
    }

    return {
      pkg,
      status: "import-failed",
      tracedPackages: tracedPkgNames,
      error: errMsg,
    };
  }

  return { pkg, status: "ok", tracedPackages: tracedPkgNames };
}

// Run traces in parallel with concurrency limit
const CONCURRENCY = 8;
const results: TraceResult[] = [];
let done = 0;
const total = packages.length;
const queue = [...packages];

async function worker() {
  while (queue.length > 0) {
    const pkg = queue.shift()!;
    const result = await tracePkg(pkg);
    results.push(result);
    done++;
    const status =
      result.status === "ok"
        ? c.green(`✓ (${result.tracedPackages!.length} pkgs)`)
        : result.status === "source-failed"
          ? c.yellow(`⚠ source import also fails${result.error ? `: ${result.error}` : ""}`)
          : c.red(`✗ ${result.status}${result.error ? `: ${result.error}` : ""}`);
    console.log(`  ${c.dim(`[${done}/${total}]`)} ${pkg} ${status}`);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

// Report
console.log("\n" + "=".repeat(60));
console.log("TRACE RESULTS");
console.log("=".repeat(60));

const grouped = {
  ok: results.filter((r) => r.status === "ok"),
  "install-failed": results.filter((r) => r.status === "install-failed"),
  "trace-failed": results.filter((r) => r.status === "trace-failed"),
  "import-failed": results.filter((r) => r.status === "import-failed"),
  "source-failed": results.filter((r) => r.status === "source-failed"),
};

console.log(c.green(`\n## Traced OK (${grouped.ok.length})\n`));
for (const r of grouped.ok) {
  console.log(
    `  ${c.green("✓")} ${r.pkg.padEnd(40)} ${c.dim(`${r.tracedPackages!.length} packages`)}`,
  );
}

if (grouped["trace-failed"].length > 0) {
  console.log(c.red(`\n## Trace Failed (${grouped["trace-failed"].length})\n`));
  for (const r of grouped["trace-failed"]) {
    console.log(`  ${c.red("✗")} ${r.pkg.padEnd(40)} ${c.dim(r.error || "")}`);
  }
}

if (grouped["import-failed"].length > 0) {
  console.log(c.yellow(`\n## Import Failed (${grouped["import-failed"].length})\n`));
  for (const r of grouped["import-failed"]) {
    console.log(`  ${c.yellow("!")} ${r.pkg.padEnd(40)} ${c.dim(r.error || "")}`);
  }
}

if (grouped["install-failed"].length > 0) {
  console.log(c.yellow(`\n## Install Failed (${grouped["install-failed"].length})\n`));
  for (const r of grouped["install-failed"]) {
    console.log(`  ${c.yellow("!")} ${r.pkg}`);
  }
}

if (grouped["source-failed"].length > 0) {
  console.log(c.dim(`\n## Source Import Failed (${grouped["source-failed"].length})\n`));
  for (const r of grouped["source-failed"]) {
    console.log(`  ${c.dim("~")} ${r.pkg.padEnd(40)} ${c.dim(r.error || "")}`);
  }
}

console.log(`\n${"=".repeat(60)}`);
console.log(
  `Totals: ${c.green(`ok=${grouped.ok.length}`)} ${c.red(`trace-failed=${grouped["trace-failed"].length}`)} ${c.yellow(`import-failed=${grouped["import-failed"].length}`)} ${c.yellow(`install-failed=${grouped["install-failed"].length}`)} ${c.dim(`source-failed=${grouped["source-failed"].length}`)}`,
);
