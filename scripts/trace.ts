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
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { NodeNativePackages } from "../src/db.ts";
import { traceNodeModules } from "../src/trace.ts";

const { values: args } = parseArgs({
  options: {
    package: { type: "string", short: "p", multiple: true },
  },
});

const BUN = join(process.env.HOME!, ".bun/bin/bun");
const rootDir = resolve(fileURLToPath(import.meta.url), "../..");
const baseDir = join(rootDir, "scripts/.trace");

// Filter packages if -p flag is provided
const packages = args.package?.length
  ? NodeNativePackages.filter((p) => args.package!.some((f) => p === f || p.startsWith(f + "/")))
  : NodeNativePackages;

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
  status: "ok" | "install-failed" | "trace-failed" | "import-failed";
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
      hooks: {
        tracedPackages(packages) {
          tracedPkgNames = Object.keys(packages);
        },
      },
    });
  } catch (err: any) {
    return { pkg, status: "trace-failed", error: err.message };
  }

  // Verify: check traced output has node_modules with the package
  const tracedNm = join(outDir, "node_modules");
  // const tracedPkgJson = join(outDir, "package.json");

  if (!existsSync(tracedNm)) {
    return { pkg, status: "trace-failed", error: "no node_modules in output" };
  }

  // Verify the package can be resolved from the traced output
  const pkgBase = pkg.startsWith("@") ? pkg.split("/").slice(0, 2).join("/") : pkg.split("/")[0]!;

  const tracedPkgDir = join(tracedNm, pkgBase);
  if (!existsSync(tracedPkgDir)) {
    return {
      pkg,
      status: "import-failed",
      tracedPackages: tracedPkgNames,
      error: `${pkgBase} not found in traced output`,
    };
  }

  // Verify package.json exists in traced package
  const tracedPkgPkgJson = join(tracedPkgDir, "package.json");
  if (!existsSync(tracedPkgPkgJson)) {
    return {
      pkg,
      status: "import-failed",
      tracedPackages: tracedPkgNames,
      error: "no package.json in traced package",
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
        ? `✓ (${result.tracedPackages!.length} pkgs)`
        : `✗ ${result.status}${result.error ? `: ${result.error}` : ""}`;
    console.log(`  [${done}/${total}] ${pkg} ${status}`);
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
};

console.log(`\n## Traced OK (${grouped.ok.length})\n`);
for (const r of grouped.ok) {
  console.log(`  ${r.pkg.padEnd(40)} ${r.tracedPackages!.length} packages`);
}

if (grouped["trace-failed"].length > 0) {
  console.log(`\n## Trace Failed (${grouped["trace-failed"].length})\n`);
  for (const r of grouped["trace-failed"]) {
    console.log(`  ${r.pkg.padEnd(40)} ${r.error}`);
  }
}

if (grouped["import-failed"].length > 0) {
  console.log(`\n## Import Failed (${grouped["import-failed"].length})\n`);
  for (const r of grouped["import-failed"]) {
    console.log(`  ${r.pkg.padEnd(40)} ${r.error}`);
  }
}

if (grouped["install-failed"].length > 0) {
  console.log(`\n## Install Failed (${grouped["install-failed"].length})\n`);
  for (const r of grouped["install-failed"]) {
    console.log(`  ${r.pkg}`);
  }
}

console.log(`\n${"=".repeat(60)}`);
console.log(
  `Totals: ok=${grouped.ok.length}, trace-failed=${grouped["trace-failed"].length}, import-failed=${grouped["import-failed"].length}, install-failed=${grouped["install-failed"].length}`,
);
