// Tests against the built bundle, which includes the patches from `build/patch-libs.ts`
// (`src` imports unpatched `@vercel/nft` from node_modules). Requires `pnpm build` first.
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

const distEntry = fileURLToPath(new URL("../dist/index.mjs", import.meta.url));

// Writes `files` to a project dir whose path contains glob syntax, traces `index.cjs`
// and returns a helper to check which files were copied to `out/node_modules`
async function traceFixture(name: string, files: Record<string, string>) {
  const { traceNodeModules } = await import(distEntry);
  const rootDir = path.join(fileURLToPath(new URL("dist", import.meta.url)), `${name} [x] (y)`);
  await rm(rootDir, { recursive: true, force: true });
  for (const [file, contents] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(rootDir, file)), { recursive: true });
    await writeFile(path.join(rootDir, file), contents);
  }
  await traceNodeModules([path.join(rootDir, "index.cjs")], { rootDir, outDir: "out" });
  return (file: string) => existsSync(path.join(rootDir, "out/node_modules", file));
}

const pkgJSON = (name: string, extra?: object) =>
  JSON.stringify({ name, version: "1.0.0", main: "index.js", ...extra });

describe.skipIf(!existsSync(distEntry))("dist (patched @vercel/nft)", () => {
  // `analyze.js` patch + `glob` shim
  it("traces wildcard requires and assets in paths with glob syntax", async () => {
    const traced = await traceFixture("wildcard", {
      "index.cjs": `require("pkg");\n`,
      "node_modules/pkg/package.json": pkgJSON("pkg"),
      "node_modules/pkg/index.js": [
        `const fs = require("node:fs");`,
        `const path = require("node:path");`,
        `exports.locale = (name) => require("./locales/" + name + "/index");`,
        `exports.asset = (name) => fs.readFileSync(path.join(__dirname, "assets", name));`,
      ].join("\n"),
      "node_modules/pkg/locales/en/index.js": `module.exports = "en";\n`,
      "node_modules/pkg/locales/fr/index.json": `"fr"\n`,
      "node_modules/pkg/locales/en/readme.md": "",
      "node_modules/pkg/locales/node_modules/x/index.js": "",
      "node_modules/pkg/assets/a.txt": "",
      "node_modules/pkg/assets/.dotfile": "",
      "node_modules/pkg/assets/sub/b.txt": "",
      "node_modules/pkg/assets/node_modules/c.txt": "",
    });

    expect(traced("pkg/locales/en/index.js")).toBe(true);
    expect(traced("pkg/locales/fr/index.json")).toBe(true);
    expect(traced("pkg/locales/en/readme.md")).toBe(false);
    expect(traced("pkg/assets/a.txt")).toBe(true);
    expect(traced("pkg/assets/.dotfile")).toBe(true);
    expect(traced("pkg/assets/sub/b.txt")).toBe(true);
    // Nested `node_modules` are ignored
    expect(traced("pkg/locales/node_modules")).toBe(false);
    expect(traced("x")).toBe(false);
    expect(traced("pkg/assets/node_modules")).toBe(false);
  });

  // `sharedlib-emit.js` patch + `glob` shim
  it("traces shared libraries next to native addons", async () => {
    const traced = await traceFixture("sharedlib", {
      "index.cjs": `require("native");\n`,
      "node_modules/native/package.json": pkgJSON("native"),
      "node_modules/native/index.js": `module.exports = require("./build/Release/native.node");\n`,
      "node_modules/native/build/Release/native.node": "",
      "node_modules/native/lib/libfoo.so.1": "",
      "node_modules/native/lib/libfoo.dylib": "",
      "node_modules/native/lib/foo.dll": "",
      "node_modules/native/lib/node_modules/libbar.so": "",
    });

    expect(traced("native/build/Release/native.node")).toBe(true);
    expect(traced("native/lib/libfoo.so.1")).toBe(process.platform !== "win32");
    expect(traced("native/lib/libfoo.dylib")).toBe(process.platform === "darwin");
    expect(traced("native/lib/foo.dll")).toBe(process.platform === "win32");
    expect(traced("native/lib/node_modules")).toBe(false);
  });

  // `binary-locators.js` patch
  it("traces nbind binaries", async () => {
    const traced = await traceFixture("nbind", {
      "index.cjs": `require("nbind-pkg");\n`,
      "node_modules/nbind-pkg/package.json": pkgJSON("nbind-pkg", { main: "lib/index.js" }),
      // nft adds the binding path relative to the importer without `./`, so it only
      // resolves when outside the importer's dir
      "node_modules/nbind-pkg/lib/index.js": [
        `const path = require("node:path");`,
        `module.exports = require("nbind").init(path.join(__dirname, "..")).lib;`,
      ].join("\n"),
      "node_modules/nbind-pkg/build/Release/nbind.node": "",
    });

    expect(traced("nbind-pkg/build/Release/nbind.node")).toBe(true);
  });

  // `@mapbox/node-pre-gyp` shims and `versioning.js` patch
  it("traces node-pre-gyp binaries", async () => {
    const { platform, arch } = process;
    const findBinding = [
      `const binary = require("@mapbox/node-pre-gyp");`,
      `const path = require("node:path");`,
      `module.exports = require(binary.find(path.resolve(path.join(__dirname, "./package.json"))));`,
    ].join("\n");
    const traced = await traceFixture("pregyp", {
      "index.cjs": `require("abi-pkg");\nrequire("napi-pkg");\n`,
      "node_modules/abi-pkg/package.json": pkgJSON("abi-pkg", {
        binary: {
          module_name: "binding",
          module_path: "./lib/{node_abi}-{platform}-{arch}",
          host: "https://example.com",
        },
      }),
      "node_modules/abi-pkg/index.js": findBinding,
      [`node_modules/abi-pkg/lib/node-v${process.versions.modules}-${platform}-${arch}/binding.node`]:
        "",
      "node_modules/napi-pkg/package.json": pkgJSON("napi-pkg", {
        binary: {
          module_name: "binding",
          module_path: "./lib/napi-v{napi_build_version}",
          package_name: "{module_name}-napi-v{napi_build_version}.tar.gz",
          host: "https://example.com",
          napi_versions: [3],
        },
      }),
      "node_modules/napi-pkg/index.js": findBinding,
      "node_modules/napi-pkg/lib/napi-v3/binding.node": "",
    });

    expect(
      traced(`abi-pkg/lib/node-v${process.versions.modules}-${platform}-${arch}/binding.node`),
    ).toBe(true);
    expect(traced("napi-pkg/lib/napi-v3/binding.node")).toBe(true);
  });

  // `node-file-trace.js` patch
  // https://github.com/unjs/nf3/issues/44
  // https://github.com/vercel/nft/issues/616
  it.skipIf(process.platform === "win32")(
    "does not crash on extensionless non-regular assets (unix socket)",
    async () => {
      const { traceNodeModules } = await import(distEntry);

      const outDir = fileURLToPath(new URL("dist/unix-socket", import.meta.url));
      await rm(outDir, { recursive: true, force: true });
      await mkdir(`${outDir}/profile`, { recursive: true });

      // Like Chromium's `SingletonSocket`: a symlink to a socket in the temp dir
      // (kept short to stay under the unix socket path length limit)
      const sockDir = await mkdtemp(path.join(tmpdir(), "nf3-"));
      const sockPath = path.join(sockDir, "SingletonSocket");
      const server = createServer();
      await new Promise<void>((resolve) => server.listen(sockPath, resolve));

      try {
        await symlink(sockPath, `${outDir}/profile/SingletonSocket`);
        const input = `${outDir}/index.cjs`;
        await writeFile(
          input,
          `require("node:fs").readdirSync(require("node:path").join(__dirname, "profile"));\n`,
        );

        await expect(traceNodeModules([input], { outDir })).resolves.toBeDefined();
      } finally {
        await new Promise((resolve) => server.close(resolve));
        await rm(sockDir, { recursive: true, force: true });
      }
    },
  );
});
