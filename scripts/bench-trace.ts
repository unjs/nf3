/**
 * Benchmark suite for `traceNodeModules`.
 *
 * Traces every fixture entry point (single-version, multi-version,
 * optionalDependencies/native, and the `traceInclude` transitive cases) into a
 * throwaway output dir, repeated over many iterations, and reports timing stats.
 *
 * Usage:
 *   bun scripts/bench-trace.ts                 # benchmark ./src
 *   NF3_ITERATIONS=50 bun scripts/bench-trace.ts
 *   NF3_TRACE_MODULE=/abs/path/to/trace.ts bun scripts/bench-trace.ts   # A/B another impl
 *
 * The `NF3_TRACE_MODULE` override lets you point at a different implementation
 * (e.g. a checkout of a previous commit) to compare against, as long as it
 * exports `traceNodeModules` and its relative imports still resolve.
 */
import { fileURLToPath } from "node:url";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const traceModule =
  process.env.NF3_TRACE_MODULE || fileURLToPath(new URL("../src/index.ts", import.meta.url));
const { traceNodeModules } = (await import(traceModule)) as typeof import("../src/index.ts");

const ITERATIONS = Number(process.env.NF3_ITERATIONS || 25);
const WARMUP = Number(process.env.NF3_WARMUP || 5);

const fixtureDir = fileURLToPath(new URL("../test/fixture", import.meta.url));
const outRoot = join(tmpdir(), "nf3-bench-out");
const F = (f: string) => join(fixtureDir, f);

type Scenario = {
  name: string;
  input: string[];
  opts: Parameters<typeof traceNodeModules>[1];
};

const scenarios: Scenario[] = [
  // single-version + multi-version dedup + subpath exports
  { name: "index", input: [F("index.mjs")], opts: { rootDir: fixtureDir } },
  // optionalDependencies with restrictive exports + .node glob
  { name: "native", input: [F("native.mjs")], opts: { rootDir: fixtureDir } },
  // force-include with transitive runtime deps
  {
    name: "force-include",
    input: [F("force-include.mjs")],
    opts: { rootDir: fixtureDir, traceInclude: ["@fixture/force-included"] },
  },
  // force-include whose own dep is multi-version (dedup under the includer)
  {
    name: "force-include-mv",
    input: [F("force-include-mv.mjs")],
    opts: { rootDir: fixtureDir, traceInclude: ["@fixture/force-included-mv"] },
  },
  // force-include that must not follow dev-only files
  {
    name: "force-include-dev",
    input: [F("force-include-dev.mjs")],
    opts: { rootDir: fixtureDir, traceInclude: ["@fixture/force-included-dev"] },
  },
];

async function runScenario(s: Scenario): Promise<number> {
  const outDir = join(outRoot, s.name);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const start = performance.now();
  await traceNodeModules(s.input, { ...s.opts, outDir });
  return performance.now() - start;
}

function stats(xs: number[]) {
  const sorted = [...xs].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const p = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
  return { min: sorted[0]!, median: p(0.5), p90: p(0.9), mean: sum / sorted.length };
}

const fmt = (n: number) => n.toFixed(2).padStart(8);

async function main() {
  console.log(`module:     ${traceModule}`);
  console.log(`iterations: ${ITERATIONS} (warmup ${WARMUP})`);
  console.log(`scenarios:  ${scenarios.map((s) => s.name).join(", ")}\n`);

  const perScenario: Record<string, number[]> = Object.fromEntries(
    scenarios.map((s) => [s.name, []]),
  );
  const totals: number[] = [];

  for (let i = 0; i < WARMUP + ITERATIONS; i++) {
    let iterTotal = 0;
    for (const s of scenarios) {
      const ms = await runScenario(s);
      iterTotal += ms;
      if (i >= WARMUP) perScenario[s.name]!.push(ms);
    }
    if (i >= WARMUP) totals.push(iterTotal);
  }

  await rm(outRoot, { recursive: true, force: true });

  console.log("scenario            min   median      p90     mean   (ms)");
  console.log("-".repeat(60));
  for (const s of scenarios) {
    const st = stats(perScenario[s.name]!);
    console.log(
      `${s.name.padEnd(18)}${fmt(st.min)} ${fmt(st.median)} ${fmt(st.p90)} ${fmt(st.mean)}`,
    );
  }
  const t = stats(totals);
  console.log("-".repeat(60));
  console.log(
    `${"TOTAL/iter".padEnd(18)}${fmt(t.min)} ${fmt(t.median)} ${fmt(t.p90)} ${fmt(t.mean)}`,
  );

  // Machine-readable line for A/B tooling.
  console.log(`\nRESULT median_total_ms=${t.median.toFixed(3)} mean_total_ms=${t.mean.toFixed(3)}`);
}

await main();
