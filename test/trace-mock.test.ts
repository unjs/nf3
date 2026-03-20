import { describe, expect, it, vi, beforeEach } from "vitest";
import { join } from "pathe";
import type { ExternalsTraceOptions, TraceHooks } from "../src/types.ts";
import {
  resetMockFs,
  writtenFiles,
  writtenSymlinks,
  createNftResult,
  seedPackages,
} from "./_mock-utils.ts";

const { nodeFileTrace } = await import("@vercel/nft");
const { traceNodeModules } = await import("../src/trace.ts");
const mockNodeFileTrace = vi.mocked(nodeFileTrace);

// --- Test matrix types ---

interface TraceScenario {
  name: string;
  packages: Record<string, { version: string; files: Record<string, string>; exports?: any }>;
  /** Extra files to seed outside node_modules (path relative to tmpDir -> content) */
  extraFiles?: Record<string, string>;
  nftResult: Record<string, { parents?: string[]; ignored?: boolean }>;
  opts?: Partial<ExternalsTraceOptions>;
  /** Assert output files exist with expected content (path relative to outDir) */
  expectFiles?: Record<string, string | ((content: string) => void)>;
  /** Assert output files do NOT exist (paths relative to outDir) */
  expectNoFiles?: string[];
  /** Assert nft was called with these options (partial match) */
  expectNftOpts?: Record<string, any>;
  /** Assert symlinks were created (at least one matching path) */
  expectSymlinks?: boolean;
  /** Assert written package.json fields (path relative to outDir -> partial match) */
  expectPkgJson?: Record<string, Record<string, any>>;
  /** Assert chmod was called */
  expectChmod?: { path: string; mode: number };
}

const ROOT = "/test-root";
const OUT = join(ROOT, "dist");
const NM = join(ROOT, "node_modules");
const OUT_NM = join(OUT, "node_modules");

/** Shorthand: create nft file path from package name + subpath */
const nm = (pkg: string, file: string) => join(NM, pkg, file);

const scenarios: TraceScenario[] = [
  {
    name: "traces single package and copies files",
    packages: { "pkg-a": { version: "1.0.0", files: { "index.js": "module.exports = 'a'" } } },
    nftResult: { [nm("pkg-a", "index.js")]: {} },
    expectFiles: { "node_modules/pkg-a/index.js": "module.exports = 'a'" },
    expectPkgJson: { "node_modules/pkg-a/package.json": { name: "pkg-a", version: "1.0.0" } },
  },
  {
    name: "skips ignored nft files",
    packages: { "pkg-a": { version: "1.0.0", files: { "index.js": "a" } } },
    nftResult: { [nm("pkg-a", "index.js")]: { ignored: true } },
    expectNoFiles: ["node_modules/pkg-a/index.js"],
  },
  {
    name: "skips files outside node_modules",
    packages: {},
    extraFiles: { "src/app.js": "console.log('app')" },
    nftResult: { [join(ROOT, "src/app.js")]: {} },
    expectNoFiles: ["node_modules"],
  },
  {
    name: "handles multiple packages",
    packages: {
      "pkg-a": { version: "1.0.0", files: { "index.js": "a" } },
      "pkg-b": { version: "2.3.0", files: { "lib/main.js": "b" } },
    },
    nftResult: {
      [nm("pkg-a", "index.js")]: {},
      [nm("pkg-b", "lib/main.js")]: {},
    },
    expectFiles: {
      "node_modules/pkg-a/index.js": "a",
      "node_modules/pkg-b/lib/main.js": "b",
    },
  },
  {
    name: "handles scoped packages",
    packages: { "@scope/pkg": { version: "1.0.0", files: { "index.js": "scoped" } } },
    nftResult: { [nm("@scope/pkg", "index.js")]: {} },
    expectFiles: { "node_modules/@scope/pkg/index.js": "scoped" },
  },
  {
    name: "handles multiple files in same package",
    packages: {
      "pkg-a": {
        version: "1.0.0",
        files: { "index.js": "main", "lib/utils.js": "utils", "lib/helpers.js": "helpers" },
      },
    },
    nftResult: {
      [nm("pkg-a", "index.js")]: {},
      [nm("pkg-a", "lib/utils.js")]: {},
      [nm("pkg-a", "lib/helpers.js")]: {},
    },
    expectFiles: {
      "node_modules/pkg-a/index.js": "main",
      "node_modules/pkg-a/lib/utils.js": "utils",
      "node_modules/pkg-a/lib/helpers.js": "helpers",
    },
  },
  {
    name: "applies single transform",
    packages: { "pkg-a": { version: "1.0.0", files: { "index.js": "const DEV = true;" } } },
    nftResult: { [nm("pkg-a", "index.js")]: {} },
    opts: {
      transform: [
        { filter: (id) => id.endsWith(".js"), handler: (code) => code.replace("DEV = true", "DEV = false") },
      ],
    },
    expectFiles: { "node_modules/pkg-a/index.js": "const DEV = false;" },
  },
  {
    name: "chains multiple transformers",
    packages: { "pkg-a": { version: "1.0.0", files: { "index.js": "hello world" } } },
    nftResult: { [nm("pkg-a", "index.js")]: {} },
    opts: {
      transform: [
        { filter: (id) => id.endsWith(".js"), handler: (code) => code.replace("hello", "hi") },
        { filter: (id) => id.endsWith(".js"), handler: (code) => code.replace("world", "earth") },
      ],
    },
    expectFiles: { "node_modules/pkg-a/index.js": "hi earth" },
  },
  {
    name: "skips transform when filter returns false",
    packages: { "pkg-a": { version: "1.0.0", files: { "data.json": '{"key":"value"}' } } },
    nftResult: { [nm("pkg-a", "data.json")]: {} },
    opts: {
      transform: [{ filter: (id) => id.endsWith(".js"), handler: () => "REPLACED" }],
    },
    expectFiles: { "node_modules/pkg-a/data.json": '{"key":"value"}' },
  },
  {
    name: "applies production condition to exports",
    packages: {
      "pkg-a": {
        version: "1.0.0",
        files: { "index.js": "a" },
        exports: { ".": { production: "./dist/prod.mjs", import: "./dist/dev.mjs", default: "./dist/dev.cjs" } },
      },
    },
    nftResult: { [nm("pkg-a", "index.js")]: {} },
    expectPkgJson: {
      "node_modules/pkg-a/package.json": {
        exports: { ".": { production: "./dist/prod.mjs", import: "./dist/dev.mjs", default: "./dist/prod.mjs" } },
      },
    },
  },
  {
    name: "writes root package.json when writePackageJson is true",
    packages: {
      "pkg-a": { version: "1.0.0", files: { "index.js": "a" } },
      "pkg-b": { version: "2.0.0", files: { "index.js": "b" } },
    },
    nftResult: {
      [nm("pkg-a", "index.js")]: {},
      [nm("pkg-b", "index.js")]: {},
    },
    opts: { writePackageJson: true },
    expectPkgJson: {
      "package.json": { name: "traced-node-modules", dependencies: { "pkg-a": "1.0.0", "pkg-b": "2.0.0" } },
    },
  },
  {
    name: "filters require/import/default from conditions passed to nft",
    packages: {},
    nftResult: {},
    opts: { conditions: ["node", "import", "production", "default"] },
    expectNftOpts: { conditions: ["node", "production"] },
  },
  {
    name: "uses default conditions (filters to ['node'])",
    packages: {},
    nftResult: {},
    expectNftOpts: { conditions: ["node"] },
  },
  {
    name: "passes nft options through",
    packages: {},
    nftResult: {},
    opts: { nft: { ignore: ["pkg-ignore/**"] } },
    expectNftOpts: { ignore: ["pkg-ignore/**"], base: "/", exportsOnly: true },
  },
  {
    name: "falls back to version 0.0.0 for missing package.json",
    packages: {},
    nftResult: { [nm("ghost-pkg", "index.js")]: {} },
    extraFiles: { "node_modules/ghost-pkg/index.js": "ghost" },
    expectPkgJson: { "node_modules/ghost-pkg/package.json": { version: "0.0.0" } },
  },
  {
    name: "applies chmod to copied files",
    packages: { "pkg-a": { version: "1.0.0", files: { "index.js": "a" } } },
    nftResult: { [nm("pkg-a", "index.js")]: {} },
    opts: { chmod: 0o644 },
    expectChmod: { path: join(OUT_NM, "pkg-a/index.js"), mode: 0o644 },
  },
  {
    name: "handles multi-version packages with .nf3 symlinks",
    packages: {
      "pkg-a": { version: "1.0.0", files: { "index.js": "a" } },
      "pkg-b": { version: "1.0.0", files: { "index.js": "b" } },
      "pkg-shared": { version: "1.0.0", files: { "index.js": "shared-v1" } },
    },
    extraFiles: {
      "node_modules/pkg-b/node_modules/pkg-shared/package.json": JSON.stringify({ name: "pkg-shared", version: "2.0.0" }),
      "node_modules/pkg-b/node_modules/pkg-shared/index.js": "shared-v2",
    },
    nftResult: {
      [nm("pkg-a", "index.js")]: {},
      [nm("pkg-b", "index.js")]: {},
      [nm("pkg-shared", "index.js")]: { parents: [nm("pkg-a", "index.js")] },
      [join(NM, "pkg-b/node_modules/pkg-shared", "index.js")]: { parents: [nm("pkg-b", "index.js")] },
    },
    expectSymlinks: true,
  },
];

describe("traceNodeModules (mocked nft)", () => {
  beforeEach(() => {
    resetMockFs();
    mockNodeFileTrace.mockReset();
  });

  // --- Matrix-driven tests ---
  for (const s of scenarios) {
    it(s.name, async () => {
      seedPackages(ROOT, s.packages);

      if (s.extraFiles) {
        for (const [rel, content] of Object.entries(s.extraFiles)) {
          writtenFiles.set(join(ROOT, rel), content);
        }
      }

      mockNodeFileTrace.mockResolvedValue(createNftResult(s.nftResult));

      await traceNodeModules([join(ROOT, "entry.js")], {
        rootDir: ROOT,
        outDir: OUT,
        ...s.opts,
      });

      if (s.expectFiles) {
        for (const [rel, expected] of Object.entries(s.expectFiles)) {
          const content = writtenFiles.get(join(OUT, rel));
          if (typeof expected === "function") {
            expected(content!);
          } else {
            expect(content, `expected ${rel}`).toBe(expected);
          }
        }
      }

      if (s.expectNoFiles) {
        for (const rel of s.expectNoFiles) {
          const found = [...writtenFiles.keys()].some((p) => p.startsWith(join(OUT, rel)));
          expect(found, `expected ${rel} to not exist`).toBe(false);
        }
      }

      if (s.expectNftOpts) {
        expect(mockNodeFileTrace).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining(s.expectNftOpts),
        );
      }

      if (s.expectPkgJson) {
        for (const [rel, expected] of Object.entries(s.expectPkgJson)) {
          const raw = writtenFiles.get(join(OUT, rel));
          expect(raw, `expected ${rel} to be written`).toBeDefined();
          expect(JSON.parse(raw!)).toMatchObject(expected);
        }
      }

      if (s.expectSymlinks) {
        expect(writtenSymlinks.size).toBeGreaterThan(0);
      }

      if (s.expectChmod) {
        const { chmod } = await import("node:fs/promises");
        expect(chmod).toHaveBeenCalledWith(s.expectChmod.path, s.expectChmod.mode);
      }
    });
  }

  // --- Tests that need custom logic beyond the matrix ---

  it("invokes all hooks in order", async () => {
    seedPackages(ROOT, {
      "pkg-a": { version: "1.0.0", files: { "index.js": "a" } },
    });

    const pkgFile = nm("pkg-a", "index.js");
    mockNodeFileTrace.mockResolvedValue(createNftResult({ [pkgFile]: {} }));

    const callOrder: string[] = [];
    const hooks: TraceHooks = {
      traceStart: vi.fn(() => { callOrder.push("traceStart"); }),
      traceResult: vi.fn(() => { callOrder.push("traceResult"); }),
      tracedFiles: vi.fn(() => { callOrder.push("tracedFiles"); }),
      tracedPackages: vi.fn(() => { callOrder.push("tracedPackages"); }),
    };

    await traceNodeModules([join(ROOT, "entry.js")], {
      rootDir: ROOT,
      outDir: OUT,
      hooks,
    });

    expect(callOrder).toEqual(["traceStart", "traceResult", "tracedFiles", "tracedPackages"]);
    expect(hooks.traceStart).toHaveBeenCalledWith([join(ROOT, "entry.js")]);
    expect(hooks.tracedFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        [pkgFile]: expect.objectContaining({ pkgName: "pkg-a" }),
      }),
    );
    expect(hooks.tracedPackages).toHaveBeenCalledWith(
      expect.objectContaining({
        "pkg-a": expect.objectContaining({
          name: "pkg-a",
          versions: expect.objectContaining({
            "1.0.0": expect.objectContaining({
              pkgJSON: expect.objectContaining({ version: "1.0.0" }),
            }),
          }),
        }),
      }),
    );
  });
});
