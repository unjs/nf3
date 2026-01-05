/**
 * Known packages that include native code and require platform-specific builds.
 *
 * These packages cannot be bundled and should be traced as external dependencies most of the time.
 */
export const NodeNativePackages: readonly string[] = Object.freeze([
  "canvas",
  "sharp",
  "gl",

  "bcrypt",
  "kerberos",
  "scrypt",
  "blake-hash",
  "sodium-native",

  "better-sqlite3",
  "leveldown",
  "lmdb",
  "sqlite3",

  "lz4",

  "deasync",
  "node-gyp",
  "node-sass",
  "@parcel/watcher",
  "@parcel/source-map",
  "@mapbox/node-pre-gyp",

  "edge-js",
  "fsevents",
  "node-pty",
  "usb",

  "ffi-napi",
  "ref-napi",
  "ref-struct-napi",
  "ref-union-napi",

  "grpc",

  "bufferutil",
  "utf-8-validate",
  "keytar",
]);
