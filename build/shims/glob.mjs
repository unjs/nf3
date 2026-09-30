// Replaces `glob` for @vercel/nft with `tinyglobby`.
//
// nft call sites are patched (see ../patch-libs.ts) to pass `[dir, pattern]` instead of
// `dir + pattern`, so `dir` is used literally as `cwd` (paths may contain glob syntax such
// as `(` or `[`).

import { resolve } from "node:path";
import { glob as tinyglobby } from "tinyglobby";

export async function glob([cwd, pattern], opts = {}) {
  const prefix = cwd + "/";
  const files = await tinyglobby(pattern.replace(/^\//, ""), {
    cwd: cwd || "/",
    absolute: true,
    dot: !!opts.dot,
    onlyFiles: !!opts.nodir,
    expandDirectories: false,
    ignore: opts.ignore?.startsWith(prefix) ? opts.ignore.slice(prefix.length) : opts.ignore,
  });
  return files.map((file) => resolve(file));
}
