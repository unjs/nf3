/**
 * Known packages that include native code and require platform-specific builds.
 *
 * These packages cannot be bundled and should be traced as external dependencies most of the time.
 */
export const NodeNativePackages: readonly string[] = Object.freeze([
  // Graphics / Image processing
  "canvas", // Native Cairo-backed 2D canvas
  "sharp", // Native libvips image processing
  "@vercel/og", // Uses native image generation under the hood
  "gl", // Native OpenGL bindings
  "@napi-rs/canvas", // N-API canvas bindings
  "@napi-rs/image", // N-API image processing bindings
  "@takumi-rs/core", // Image Renderer with the same N-API dependency structure

  // Crypto / Hashing
  "bcrypt", // Native bcrypt password hashing
  "kerberos", // Native Kerberos authentication
  "scrypt", // Native scrypt key derivation
  "blake-hash", // Native BLAKE hash function
  "sodium-native", // Native libsodium bindings
  "argon2", // Native Argon2 password hashing
  "@node-rs/argon2", // N-API Argon2 bindings
  "@node-rs/bcrypt", // N-API bcrypt bindings
  "cpu-features", // Native CPU feature detection
  "farmhash", // Native Google FarmHash bindings
  "@node-rs/xxhash", // N-API xxhash bindings
  "@node-rs/crc32", // N-API CRC32 bindings

  // Database
  "better-sqlite3", // Native SQLite3 bindings
  "leveldown", // Native LevelDB bindings
  "lmdb", // Native LMDB bindings
  "sqlite3", // Native SQLite3 bindings (node-sqlite3)
  "libsql", // Native LibSQL/Turso bindings
  "node-rdkafka", // Native Kafka client
  "couchbase", // Native Couchbase SDK
  "duckdb", // Native analytical DB bindings
  "realm", // Native mobile database bindings

  // Compression
  "lz4", // Native LZ4 compression
  "zlib-sync", // Native synchronous zlib bindings
  "snappy", // Native Snappy compression
  "@napi-rs/snappy", // N-API Snappy bindings
  "@napi-rs/lz4", // N-API LZ4 bindings
  "msgpackr-extract", // Native msgpack extraction
  "@mongodb-js/zstd", // Native zstd bindings used by MongoDB ecosystem

  // Tooling / Build
  "deasync", // Native event loop de-async
  "node-gyp", // Native addon build tool
  "node-sass", // Native libsass bindings
  "@parcel/watcher", // Native filesystem watcher
  "@parcel/source-map", // Native source map processing
  "@mapbox/node-pre-gyp", // Native addon binary distribution tool
  "@swc/core", // Rust-based SWC compiler
  "esbuild", // Go-based bundler with native binaries
  "lightningcss", // Rust-based CSS parser/transformer
  "@biomejs/biome", // Rust-based linter/formatter
  "tree-sitter", // Native parser generator
  "re2", // Native Google RE2 regex engine
  "onnxruntime-node", // Native ONNX runtime bindings

  // System / Platform
  "edge-js", // Native .NET CLR interop
  "fsevents", // Native macOS filesystem events
  "node-pty", // Native pseudo-terminal bindings
  "usb", // Native USB device access
  "@serialport/bindings-cpp", // Native serial port bindings
  "robotjs", // Native desktop automation
  "node-hid", // Native HID device access
  "isolated-vm", // Native V8 isolate sandboxing
  "dtrace-provider", // Native DTrace probes
  "microtime", // Native high-resolution timing
  "node-datachannel", // Native WebRTC
  "zigpty", // Native NAPI bindings

  // FFI
  "ffi-napi", // N-API foreign function interface
  "ref-napi", // N-API native pointer/reference handling
  "ref-struct-napi", // N-API native struct type support
  "ref-union-napi", // N-API native union type support

  // Networking
  "grpc", // Native gRPC bindings
  "zeromq", // Native ZeroMQ bindings
  "unix-dgram", // Native Unix datagram sockets
  "ssh2", // Optional native crypto bindings

  // XML / Parsing
  "libxmljs2", // Native XML parser
  "node-expat", // Native XML SAX parser

  // ML / AI
  "@xenova/transformers", // Native ONNX runtime dependency
  "@llama-node/llama-cpp", // Native llama.cpp bindings

  // Other
  "bufferutil", // Native WebSocket buffer operations
  "utf-8-validate", // Native UTF-8 validation
  "keytar", // Native OS keychain access
  "iconv", // Native character encoding (not iconv-lite)
  "nodegit", // Native Git bindings
  "@sentry/profiling-node", // Native V8 profiling bindings
  "turbo-crc32", // Native CRC32C bindings
  "@napi-rs/clipboard", // N-API clipboard access
  "better-sqlite3-multiple-ciphers", // Encrypted SQLite variant
  "pdfium.js", // Native PDFium bindings
  "cbor-extract", // Native CBOR extraction
  "diskusage", // Native disk usage stats
  "nsfw", // Native file watcher
  "native-reg", // Native Windows registry access
  "integer", // Native 64-bit integer support
  "spawn-sync", // Native spawn_sync fallback
  "md4x/napi", // N-API bindings for markdown rendering
]);

/**
 * Packages that must be externalized (traced as dependencies) rather than bundled,
 * due to bundler compatibility issues with their module format or dynamic imports.
 */
export const NonBundleablePackages = [
  // Database drivers / ORMs
  "pg-native", // Dynamic native binary loading companion to pg
  "typeorm", // Dynamic entity/driver loading via require()
  "prisma", // CLI with engine binaries and __dirname usage
  "@prisma/client", // CJS module using __dirname incompatible with Rollup/Rolldown bundling

  // APM / Observability
  "@sentry/tanstackstart-react", // Vite export from SDK breaks build
  "dd-trace", // Datadog APM; require hooks and monkey-patching
  "newrelic", // New Relic agent; monkey-patches core modules via dynamic requires
  "applicationinsights", // Azure APM; monkey-patching and dynamic requires

  // Serverless / Runtime
  "@vercel/node", // Runtime helpers that expect external resolution

  // Other
  "puppeteer", // Downloads Chromium binary; __dirname-based resolution
  "playwright", // Downloads browser binaries; dynamic binary resolution
  "tslib", // Often problematic when bundled
];
