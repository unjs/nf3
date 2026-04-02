#!/usr/bin/env bun

/**
 * Analyzes NodeNativePackages from db.ts to classify their native binary distribution strategy.
 *
 * Categories:
 * - prebuilt: Ships .node files, prebuilds/ dirs, or napi-rs platform optional deps
 * - gyp: Requires compilation via binding.gyp / node-gyp
 * - noNative: No native files detected (meta-packages or JS wrappers)
 * - notInstalled: Install failed (platform-specific, deprecated, etc.)
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeNativePackages } from "../src/db.ts";

const BUN = join(process.env.HOME!, ".bun/bin/bun");
const rootDir = resolve(fileURLToPath(import.meta.url), "../..");

// Dedupe subpath exports to base package name (e.g. "md4x/napi" -> "md4x")
const installPackages = [
  ...new Set(
    NodeNativePackages.map((p) => {
      // Scoped: @scope/name or @scope/name/subpath -> @scope/name
      if (p.startsWith("@")) {
        const parts = p.split("/");
        return parts.slice(0, 2).join("/");
      }
      // Unscoped: name/subpath -> name
      return p.split("/")[0]!;
    }),
  ),
];

console.log(
  `Found ${NodeNativePackages.length} packages in NodeNativePackages (${installPackages.length} to install)\n`,
);

// Use local .tmp dir (gitignored)
const dir = join(rootDir, "scripts/.analyze");
// rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
execSync(`echo '{}' > package.json`, { cwd: dir });

// Stage 1: Install all packages in one call
console.log("Installing packages...");
try {
  execSync(`${BUN} add --no-save ${installPackages.join(" ")}`, {
    cwd: dir,
    timeout: 300_000,
    stdio: "inherit",
  });
} catch {
  console.log("Some packages failed to install (continuing with analysis)");
}

// Stage 2: Analyze all packages in parallel
console.log("\nAnalyzing packages...");
const nmDir = join(dir, "node_modules");

interface PrebuiltResult {
  pkg: string;
  nodeFiles: number;
  strategy: string;
}

interface GypResult {
  pkg: string;
  gypFile: boolean;
  hasNodeGyp: boolean;
  hasPreGyp: boolean;
}

type AnalyzeResult =
  | { type: "prebuilt"; data: PrebuiltResult }
  | { type: "gyp"; data: GypResult }
  | { type: "noNative"; pkg: string }
  | { type: "notInstalled"; pkg: string };

function analyzePkg(pkg: string): AnalyzeResult {
  const pkgName = pkg.startsWith("@") ? pkg.split("/").slice(0, 2).join("/") : pkg.split("/")[0]!;
  const pkgDir = join(nmDir, pkgName);

  if (!existsSync(pkgDir)) {
    return { type: "notInstalled", pkg };
  }

  const nodeFiles = findFiles(pkgDir, ".node");
  const hasPrebuilds =
    existsSync(join(pkgDir, "prebuilds")) || existsSync(join(pkgDir, "prebuild"));

  let pkgJson: Record<string, any>;
  try {
    pkgJson = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  } catch {
    pkgJson = {};
  }

  const allDeps = {
    ...pkgJson.dependencies,
    ...pkgJson.optionalDependencies,
  };
  const allDepNames = Object.keys(allDeps || {});
  const optDeps = Object.keys(pkgJson.optionalDependencies || {});

  // Check for platform-specific optional deps (napi-rs style)
  // Matches both unscoped (pkg-linux-x64) and scoped (@scope/linux-x64, @esbuild/darwin-arm64)
  const platformPattern = /(?:^|-|\/)(linux|darwin|win32|android|freebsd|openbsd|sunos)(?:-|$)/;
  const hasNapiPlatformDeps = optDeps.some((d) => platformPattern.test(d));

  // Check if any dep (including regular deps) is a known native package or has native indicators
  const hasNativeTransitiveDep = allDepNames.some((d) => {
    const depDir = join(nmDir, d);
    if (!existsSync(depDir)) return false;
    try {
      const depPkg = JSON.parse(readFileSync(join(depDir, "package.json"), "utf8"));
      return (
        existsSync(join(depDir, "binding.gyp")) ||
        existsSync(join(depDir, "prebuilds")) ||
        existsSync(join(depDir, "prebuild")) ||
        findFiles(depDir, ".node").length > 0 ||
        Object.keys(depPkg.optionalDependencies || {}).some((dd) => platformPattern.test(dd))
      );
    } catch {
      return false;
    }
  });

  // Check if any optional dep is a known native package from our list
  const hasNativeOptDep = optDeps.some((d) => {
    const base = d.startsWith("@") ? d.split("/").slice(0, 2).join("/") : d.split("/")[0]!;
    return installPackages.includes(base);
  });

  const installScript = (pkgJson.scripts?.install || "") + (pkgJson.scripts?.postinstall || "");
  const gypFile = existsSync(join(pkgDir, "binding.gyp"));
  const hasPreGyp =
    installScript.includes("node-pre-gyp") || installScript.includes("prebuild-install");
  const hasNodeGyp = installScript.includes("node-gyp");

  if (nodeFiles.length > 0 || hasPrebuilds || hasNapiPlatformDeps) {
    const strategy = hasNapiPlatformDeps
      ? "napi-rs platform deps"
      : hasPrebuilds
        ? "prebuilds dir"
        : ".node files";
    return { type: "prebuilt", data: { pkg, nodeFiles: nodeFiles.length, strategy } };
  } else if (gypFile || hasNodeGyp || hasPreGyp) {
    return { type: "gyp", data: { pkg, gypFile, hasNodeGyp, hasPreGyp } };
  } else if (hasNativeTransitiveDep) {
    return { type: "prebuilt", data: { pkg, nodeFiles: 0, strategy: "native transitive dep" } };
  } else if (hasNativeOptDep) {
    return { type: "prebuilt", data: { pkg, nodeFiles: 0, strategy: "native optional dep" } };
  } else {
    return { type: "noNative", pkg };
  }
}

const analyzeResults = await Promise.all(NodeNativePackages.map((pkg) => analyzePkg(pkg)));

const results = {
  prebuilt: [] as PrebuiltResult[],
  gyp: [] as GypResult[],
  noNative: [] as string[],
  notInstalled: [] as string[],
};

for (const r of analyzeResults) {
  switch (r.type) {
    case "prebuilt":
      results.prebuilt.push(r.data);
      break;
    case "gyp":
      results.gyp.push(r.data);
      break;
    case "noNative":
      results.noNative.push(r.pkg);
      break;
    case "notInstalled":
      results.notInstalled.push(r.pkg);
      break;
  }
}

// Report
console.log("\n" + "=".repeat(60));
console.log("RESULTS");
console.log("=".repeat(60));

console.log(`\n## Prebuilt NAPI (${results.prebuilt.length} packages)\n`);
for (const r of results.prebuilt) {
  console.log(`  ${r.pkg.padEnd(40)} ${r.strategy} (${r.nodeFiles} .node files)`);
}

console.log(`\n## Requires Compilation (${results.gyp.length} packages)\n`);
for (const r of results.gyp) {
  const flags = [r.gypFile && "binding.gyp", r.hasNodeGyp && "node-gyp", r.hasPreGyp && "pre-gyp"]
    .filter(Boolean)
    .join(", ");
  console.log(`  ${r.pkg.padEnd(40)} ${flags}`);
}

console.log(`\n## No Native Files Detected (${results.noNative.length} packages)\n`);
for (const p of results.noNative) {
  console.log(`  ${p}`);
}

console.log(`\n## Not Installed (${results.notInstalled.length} packages)\n`);
for (const p of results.notInstalled) {
  console.log(`  ${p}`);
}

console.log(`\n${"=".repeat(60)}`);
console.log(
  `Totals: prebuilt=${results.prebuilt.length}, gyp=${results.gyp.length}, noNative=${results.noNative.length}, notInstalled=${results.notInstalled.length}`,
);

// Update db.ts comments with status tags
const statusMap = new Map<string, string>();
for (const r of results.prebuilt) {
  statusMap.set(r.pkg, `prebuilt: ${r.strategy}`);
}
for (const r of results.gyp) {
  statusMap.set(r.pkg, "gyp");
}
for (const p of results.noNative) {
  statusMap.set(p, "no native detected");
}
for (const p of results.notInstalled) {
  statusMap.set(p, "not installable");
}

const dbPath = join(rootDir, "src/db.ts");
let dbSource = readFileSync(dbPath, "utf8");

for (const [pkg, status] of statusMap) {
  // Match: "pkg-name", // any existing comment
  // Replace comment with: [status] original comment (without old status tag)
  const escaped = pkg.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const re = new RegExp(`("${escaped}",\\s*//\\s*)(?:\\[.*?\\]\\s*)?(.*)$`, "m");
  dbSource = dbSource.replace(re, `$1[${status}] $2`);
}

writeFileSync(dbPath, dbSource);
console.log("\nUpdated db.ts comments with status tags");

// Cleanup
// rmSync(dir, { recursive: true, force: true });
// console.log(`Cleaned up ${dir}`);

// --- helpers ---

function findFiles(dir: string, ext: string, results: string[] = []): string[] {
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      try {
        const st = statSync(full);
        if (st.isDirectory()) findFiles(full, ext, results);
        else if (entry.endsWith(ext)) results.push(full);
      } catch {}
    }
  } catch {}
  return results;
}
