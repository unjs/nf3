import { describe, it, expect, beforeAll } from "vitest";
import { build as rolldownBuild } from "rolldown";
import { fileURLToPath } from "node:url";

import { NonBundleablePackages } from "../../src/db.ts";
import { join } from "node:path/posix";
import { tmpdir } from "node:os";
import { rm } from "node:fs/promises";
import { execFile as _execFile } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(_execFile);

const skip = [
  // cannot be bundled at all
  "@sentry/tanstackstart-react",
  // can be bundled but problematic at runtime
  "tslib",
  "puppeteer",
  "applicationinsights",
];

const fixtureDir = join(fileURLToPath(new URL("./", import.meta.url)));

describe("db:NonBundleablePackages", () => {
  beforeAll(async () => {
    await execFile("pnpm", ["add", ...NonBundleablePackages], {
      cwd: fixtureDir,
      shell: process.platform === "win32",
    });
  }, 120_000);

  for (const pkg of NonBundleablePackages) {
    if (skip.includes(pkg)) {
      continue;
    }
    it(`Bundled ${pkg} should throw`, async () => {
      const code = `import * as pkg from "${pkg}"; console.log(pkg);`;
      const outDir = join(tmpdir(), "nf3-tests", pkg);
      await rm(outDir, { recursive: true, force: true });
      await rolldownBuild({
        cwd: fileURLToPath(new URL("./", import.meta.url)),
        platform: "node",
        input: "#virtual-entry",
        output: {
          entryFileNames: "index.mjs",
          dir: outDir,
        },
        external: ["fsevents"],
        logLevel: "silent",
        plugins: [
          {
            name: "virtual-entry",
            resolveId(id) {
              if (id === "#virtual-entry") {
                return id;
              }
            },
            load(id) {
              if (id === "#virtual-entry") {
                return code;
              }
            },
          },
        ],
      });

      await expect(execFile("node", [join(outDir, "index.mjs")])).rejects.toThrow();
    });
  }
});
