import { vi } from "vitest";
import { join } from "pathe";

// --- In-memory fs state ---

export const writtenFiles = new Map<string, string>();
export const writtenSymlinks = new Map<string, string>();
export const filePermissions = new Map<string, number>();

export function resetMockFs() {
  writtenFiles.clear();
  writtenSymlinks.clear();
  filePermissions.clear();
}

// --- vi.mock declarations (hoisted to top-level by vitest) ---

vi.mock("@vercel/nft", () => ({
  nodeFileTrace: vi.fn(),
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...original,
    realpath: vi.fn((p: string) => Promise.resolve(p)),
    stat: vi.fn((p: string) => {
      if (writtenFiles.has(p) || p.includes("node_modules")) {
        return Promise.resolve({
          isFile: () => !p.endsWith("/"),
          isSymbolicLink: () => writtenSymlinks.has(p),
          mode: filePermissions.get(p) ?? 0o100644,
        });
      }
      return Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    }),
    lstat: vi.fn((p: string) => {
      if (writtenSymlinks.has(p)) {
        return Promise.resolve({ isSymbolicLink: () => true });
      }
      return Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    }),
    mkdir: vi.fn(() => Promise.resolve()),
    readFile: vi.fn((p: string) => {
      if (writtenFiles.has(p)) {
        return Promise.resolve(writtenFiles.get(p)!);
      }
      return Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    }),
    writeFile: vi.fn((p: string, content: string) => {
      writtenFiles.set(p, content);
      return Promise.resolve();
    }),
    copyFile: vi.fn((src: string, dst: string) => {
      const content = writtenFiles.get(src);
      if (content !== undefined) {
        writtenFiles.set(dst, content);
      }
      return Promise.resolve();
    }),
    chmod: vi.fn((p: string, mode: number) => {
      filePermissions.set(p, 0o100000 | mode);
      return Promise.resolve();
    }),
    symlink: vi.fn((target: string, path: string) => {
      writtenSymlinks.set(path, target);
      return Promise.resolve();
    }),
  };
});

// --- Helpers ---

export function createNftResult(files: Record<string, { parents?: string[]; ignored?: boolean }>) {
  const reasons = new Map();
  for (const [file, opts] of Object.entries(files)) {
    reasons.set(file, {
      type: [],
      parents: new Set(opts.parents || []),
      ignored: opts.ignored ?? false,
    });
  }
  return {
    fileList: new Set(Object.keys(files)),
    reasons,
    esmFileList: new Set<string>(),
    warnings: new Set<Error>(),
  };
}

export function seedPackages(
  baseDir: string,
  packages: Record<string, { version: string; files: Record<string, string>; exports?: any }>,
) {
  for (const [name, pkg] of Object.entries(packages)) {
    const pkgDir = join(baseDir, "node_modules", name);
    const pkgJson: Record<string, any> = { name, version: pkg.version };
    if (pkg.exports) {
      pkgJson.exports = pkg.exports;
    }
    writtenFiles.set(join(pkgDir, "package.json"), JSON.stringify(pkgJson));
    for (const [file, content] of Object.entries(pkg.files)) {
      writtenFiles.set(join(pkgDir, file), content);
    }
  }
}
