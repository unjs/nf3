/**
 * Known packages that include native code and require platform-specific builds.
 *
 * These packages cannot be bundled and should be traced as external dependencies most of the time.
 */
export const NodeNativePackages: readonly string[] = Object.freeze([
  // Graphics / Image processing
  "canvas", // [gyp] Native Cairo-backed 2D canvas
  "sharp", // [prebuilt: napi-rs platform deps] Native libvips image processing
  "@vercel/og", // [prebuilt: native transitive dep] Uses native image generation under the hood
  "gl", // [gyp] Native OpenGL bindings
  "@napi-rs/canvas", // [prebuilt: napi-rs platform deps] N-API canvas bindings
  "@napi-rs/image", // [prebuilt: napi-rs platform deps] N-API image processing bindings
  "@takumi-rs/core", // [prebuilt: napi-rs platform deps] Image Renderer with the same N-API dependency structure
  "@resvg/resvg-js", // [prebuilt: napi-rs platform deps] Rust SVG renderer

  // Crypto / Hashing / Auth
  "bcrypt", // [prebuilt: prebuilds dir] Native bcrypt password hashing
  "kerberos", // [gyp] Native Kerberos authentication
  "scrypt", // [gyp] Native scrypt key derivation
  "blake-hash", // [prebuilt: prebuilds dir] Native BLAKE hash function
  "sodium-native", // [prebuilt: prebuilds dir] Native libsodium bindings
  "argon2", // [prebuilt: prebuilds dir] Native Argon2 password hashing
  "@node-rs/argon2", // [prebuilt: napi-rs platform deps] N-API Argon2 bindings
  "@node-rs/bcrypt", // [prebuilt: napi-rs platform deps] N-API bcrypt bindings
  "@node-rs/jsonwebtoken", // [prebuilt: napi-rs platform deps] N-API JWT bindings
  "cpu-features", // [gyp] Native CPU feature detection
  "farmhash", // [prebuilt: .node files] Native Google FarmHash bindings
  "@node-rs/xxhash", // [prebuilt: napi-rs platform deps] N-API xxhash bindings
  "@node-rs/crc32", // [prebuilt: napi-rs platform deps] N-API CRC32 bindings
  "bigint-buffer", // [gyp] Native BigInt buffer conversion
  "keytar", // [gyp] Native OS keychain access

  // Database
  "better-sqlite3", // [gyp] Native SQLite3 bindings
  "better-sqlite3-multiple-ciphers", // [gyp] Encrypted SQLite variant
  "sqlite3", // [gyp] Native SQLite3 bindings (node-sqlite3)
  "leveldown", // [prebuilt: prebuilds dir] Native LevelDB bindings
  "classic-level", // [prebuilt: prebuilds dir] Native LevelDB bindings (leveldown successor)
  "lmdb", // [prebuilt: napi-rs platform deps] Native LMDB bindings
  "libsql", // [prebuilt: napi-rs platform deps] Native LibSQL/Turso bindings
  "duckdb", // [gyp] Native analytical DB bindings
  "rocksdb", // [prebuilt: prebuilds dir] Native RocksDB bindings
  "level-rocksdb", // [prebuilt: native transitive dep] LevelDB-compatible RocksDB wrapper
  "pg-native", // [prebuilt: native transitive dep] Native PostgreSQL libpq bindings
  "oracledb", // [prebuilt: .node files] Native Oracle Database bindings
  "mongodb-client-encryption", // [gyp] Native MongoDB client-side encryption
  "odbc", // [gyp] Native ODBC database bindings
  "ibm_db", // [gyp] Native IBM DB2 bindings
  "hiredis", // [gyp] Native Redis protocol parser
  "couchbase", // [prebuilt: napi-rs platform deps] Native Couchbase SDK
  "realm", // [prebuilt: prebuilds dir] Native mobile database bindings
  "node-rdkafka", // [gyp] Native Kafka client

  // Compression / Serialization
  "lz4", // [prebuilt: .node files] Native LZ4 compression
  "lz4-napi", // [prebuilt: napi-rs platform deps] N-API LZ4 bindings (napi-rs powered)
  "zlib-sync", // [gyp] Native synchronous zlib bindings
  "snappy", // [prebuilt: napi-rs platform deps] Native Snappy compression
  "@napi-rs/snappy", // [prebuilt: napi-rs platform deps] N-API Snappy bindings
  "@napi-rs/lzma", // [prebuilt: napi-rs platform deps] N-API LZMA bindings
  "@mongodb-js/zstd", // [gyp] Native zstd bindings used by MongoDB ecosystem
  "msgpackr-extract", // [prebuilt: napi-rs platform deps] Native msgpack extraction
  "cbor-extract", // [prebuilt: napi-rs platform deps] Native CBOR extraction
  "@napi-rs/tar", // [prebuilt: napi-rs platform deps] N-API tar archive handling

  // Tooling / Build
  "esbuild", // [prebuilt: napi-rs platform deps] Go-based bundler with native binaries
  "rolldown", // [prebuilt: napi-rs platform deps] Rust-based bundler
  "vite", // [prebuilt: .node files] Native platform deps via rolldown
  "@rspack/core", // [prebuilt: native transitive dep] Rust-based bundler
  "@swc/core", // [prebuilt: napi-rs platform deps] Rust-based SWC compiler
  "@swc-node/register", // [prebuilt: native transitive dep] SWC-based require hook
  "lightningcss", // [prebuilt: napi-rs platform deps] Rust-based CSS parser/transformer
  "@parcel/css", // [prebuilt: native transitive dep] Rust-based CSS transformer
  "@parcel/watcher", // [prebuilt: napi-rs platform deps] Native filesystem watcher
  "@parcel/source-map", // [prebuilt: .node files] Native source map processing
  "@biomejs/biome", // [prebuilt: napi-rs platform deps] Rust-based linter/formatter
  "oxfmt", // [prebuilt: napi-rs platform deps] Rust-based formatter
  "oxlint", // [prebuilt: napi-rs platform deps] Rust-based linter
  "oxc-parser", // [prebuilt: napi-rs platform deps] Rust-based JS/TS parser
  "oxc-transform", // [prebuilt: napi-rs platform deps] Rust-based JS/TS transformer
  "oxc-resolver", // [prebuilt: napi-rs platform deps] Rust-based module resolver
  "@ast-grep/napi", // [prebuilt: napi-rs platform deps] Rust-based AST grep
  "@napi-rs/cli", // [prebuilt: native transitive dep] N-API build toolchain
  "@node-rs/deno-lint", // [prebuilt: napi-rs platform deps] N-API Deno linter bindings
  "vize", // [prebuilt: napi-rs platform deps] Rust-based Vue toolchain
  "node-sass", // [gyp] Native libsass bindings
  "tree-sitter", // [gyp] Native parser generator
  "re2", // [gyp] Native Google RE2 regex engine
  "rollup", // [prebuilt: napi-rs platform deps] Bundler with native platform binaries (v4+)
  "sass-embedded", // [prebuilt: napi-rs platform deps] Embedded Dart Sass with platform binaries
  "@tailwindcss/oxide", // [prebuilt: napi-rs platform deps] Tailwind CSS v4 Rust engine
  "turbo", // [prebuilt: napi-rs platform deps] Turborepo native Rust CLI
  "deasync", // [prebuilt: .node files] Native event loop de-async

  // ML / AI
  "@xenova/transformers", // [prebuilt: .node files] "@llama-node/llama-cpp", // [prebuilt: .node files] "@huggingface/transformers", // [prebuilt: native transitive dep] // [prebuilt: .node files] Other
  "node-llama-cpp", // [prebuilt: napi-rs platform deps] Native llama.cpp bindings
  "llama-node", // [prebuilt: native transitive dep] Native llama bindings
  "onnxruntime-node", // [prebuilt: .node files] Native ONNX runtime bindings
  "@tensorflow/tfjs-node", // [gyp] Native TensorFlow.js bindings

  // Observability / Profiling
  "@sentry/profiling-node", // [prebuilt: native transitive dep] Native V8 profiling bindings
  "@datadog/native-metrics", // [prebuilt: prebuilds dir] Native V8 metrics collection
  "@datadog/native-appsec", // [prebuilt: prebuilds dir] Native AppSec bindings
  "@datadog/native-iast-taint-tracking", // [prebuilt: prebuilds dir] Native IAST taint tracking
  "@datadog/pprof", // [prebuilt: prebuilds dir] Native pprof profiling
  "@newrelic/native-metrics", // [prebuilt: prebuilds dir] Native V8 metrics collection
  "@appsignal/nodejs", // [gyp] Native AppSignal APM agent
  "@statsig/statsig-node-core", // [prebuilt: napi-rs platform deps] Native Statsig feature flag SDK
  "v8-profiler-next", // [gyp] Native V8 CPU/heap profiler
  "heapdump", // [gyp] Native heap snapshot generation

  // Networking
  "grpc", // [gyp] Native gRPC bindings
  "zeromq", // [prebuilt: .node files] Native ZeroMQ bindings
  "unix-dgram", // [gyp] Native Unix datagram sockets
  "ssh2", // [prebuilt: native transitive dep] Optional native crypto bindings
  "aws-crt", // [prebuilt: .node files] Native AWS Common Runtime bindings
  "node-libcurl", // [gyp] Native libcurl bindings
  "bufferutil", // [prebuilt: prebuilds dir] Native WebSocket buffer operations
  "utf-8-validate", // [prebuilt: prebuilds dir] Native UTF-8 validation

  // System / Platform
  "fsevents", // [prebuilt: .node files] Native macOS filesystem events
  "node-pty", // [prebuilt: prebuilds dir] Native pseudo-terminal bindings
  "usb", // [prebuilt: prebuilds dir] Native USB device access
  "@serialport/bindings-cpp", // [prebuilt: prebuilds dir] Native serial port bindings
  "robotjs", // [gyp] Native desktop automation
  "node-hid", // [prebuilt: prebuilds dir] Native HID device access
  "isolated-vm", // [prebuilt: prebuilds dir] Native V8 isolate sandboxing
  "dtrace-provider", // [gyp] Native DTrace probes
  "microtime", // [prebuilt: prebuilds dir] Native high-resolution timing
  "node-datachannel", // [gyp] Native WebRTC
  "zigpty", // [prebuilt: prebuilds dir] Native NAPI bindings
  "edge-js", // [prebuilt: .node files] Native .NET CLR interop
  "nsfw", // [gyp] Native file watcher
  "native-reg", // [prebuilt: prebuilds dir] Native Windows registry access
  "diskusage", // [gyp] Native disk usage stats
  "@napi-rs/clipboard", // [prebuilt: napi-rs platform deps] N-API clipboard access
  "@napi-rs/nice", // [prebuilt: napi-rs platform deps] N-API process priority
  "@napi-rs/webcodecs", // [prebuilt: napi-rs platform deps] N-API WebCodecs bindings
  "workerd", // [prebuilt: napi-rs platform deps] Cloudflare Workers runtime binary
  "node-web-audio-api", // [prebuilt: .node files] Native Web Audio API implementation

  // FFI
  "ffi-napi", // [prebuilt: prebuilds dir] N-API foreign function interface
  "ref-napi", // [prebuilt: prebuilds dir] N-API native pointer/reference handling
  "ref-struct-napi", // [prebuilt: .node files] N-API native struct type support
  "ref-union-napi", // [prebuilt: .node files] N-API native union type support

  // Encoding / Parsing
  "iconv", // [gyp] Native character encoding (not iconv-lite)
  "libxmljs2", // [gyp] Native XML parser
  "node-expat", // [prebuilt: .node files] Native XML SAX parser
  "@node-rs/jieba", // [prebuilt: napi-rs platform deps] N-API Chinese text segmentation
  "md4x/napi", // [prebuilt: .node files] N-API bindings for markdown rendering

  // Audio
  "@discordjs/opus", // [gyp] Native Opus audio codec

  // Other
  "nodegit", // [gyp] Native Git bindings
  "integer", // [gyp] Native 64-bit integer support
]);

/**
 * Packages that should be fully traced (all files copied, not just NFT-detected ones).
 *
 * These packages use dynamic requires, runtime asset loading, or other patterns
 * that prevent static analysis from detecting all required files.
 * Can be passed to the plugin's `traceInclude` option to ensure they are always traced.
 */
export const FullTracePackages = ["usb", "sodium-native", "aws-crt", "youch"] as const;

/**
 * Packages that must be externalized (traced as dependencies) rather than bundled,
 * due to bundler compatibility issues with their module format or dynamic imports.
 */
export const NonBundleablePackages = [
  // Has local assets
  "youch",

  // Database drivers / ORMs
  "pg-native", // [prebuilt: native transitive dep] Dynamic native binary loading companion to pg
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
  "playwright-core", // Dynamic __dirname-based resolution for browser connection
  "puppeteer-core", // Dynamic browser protocol resolution
  "vscode-oniguruma", // Uses .wasm
  "tslib", // Often problematic when bundled

  // Module hooking
  "@highlight-run/node", // Observability SDK; depends on require-in-the-middle
  "import-in-the-middle", // Monkey-patches ESM loader hooks
  "require-in-the-middle", // Monkey-patches require() at runtime
];
