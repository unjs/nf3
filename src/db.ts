/**
 * Known packages that include native code and require platform-specific builds.
 *
 * These packages cannot be bundled and should be traced as external dependencies most of the time.
 */
export const NodeNativePackages: readonly string[] = Object.freeze([
  // Graphics / Image processing
  "canvas", // [prebuilt: .node files] Native Cairo-backed 2D canvas
  "sharp", // [prebuilt: napi-rs platform deps] Native libvips image processing
  "@vercel/og", // [prebuilt: native transitive dep] Uses native image generation under the hood
  "gl", // [prebuilt: .node files] Native OpenGL bindings
  "@napi-rs/canvas", // [prebuilt: napi-rs platform deps] N-API canvas bindings
  "@napi-rs/image", // [prebuilt: napi-rs platform deps] N-API image processing bindings
  "@takumi-rs/core", // [prebuilt: napi-rs platform deps] Image Renderer with the same N-API dependency structure

  // Crypto / Hashing
  "bcrypt", // [prebuilt: prebuilds dir] Native bcrypt password hashing
  "kerberos", // [prebuilt: .node files] Native Kerberos authentication
  "scrypt", // [gyp] Native scrypt key derivation
  "blake-hash", // [prebuilt: prebuilds dir] Native BLAKE hash function
  "sodium-native", // [prebuilt: prebuilds dir] Native libsodium bindings
  "argon2", // [prebuilt: prebuilds dir] Native Argon2 password hashing
  "@node-rs/argon2", // [prebuilt: napi-rs platform deps] N-API Argon2 bindings
  "@node-rs/bcrypt", // [prebuilt: napi-rs platform deps] N-API bcrypt bindings
  "cpu-features", // [prebuilt: .node files] Native CPU feature detection
  "farmhash", // [prebuilt: .node files] Native Google FarmHash bindings
  "@node-rs/xxhash", // [prebuilt: napi-rs platform deps] N-API xxhash bindings
  "@node-rs/crc32", // [prebuilt: napi-rs platform deps] N-API CRC32 bindings

  // Database
  "better-sqlite3", // [prebuilt: .node files] Native SQLite3 bindings
  "leveldown", // [prebuilt: prebuilds dir] Native LevelDB bindings
  "lmdb", // [prebuilt: napi-rs platform deps] Native LMDB bindings
  "sqlite3", // [prebuilt: .node files] Native SQLite3 bindings (node-sqlite3)
  "libsql", // [prebuilt: napi-rs platform deps] Native LibSQL/Turso bindings
  "node-rdkafka", // [gyp] Native Kafka client
  "couchbase", // [prebuilt: napi-rs platform deps] Native Couchbase SDK
  "duckdb", // [prebuilt: .node files] Native analytical DB bindings
  "realm", // [prebuilt: prebuilds dir] Native mobile database bindings

  // Compression
  "lz4", // [prebuilt: .node files] Native LZ4 compression
  "zlib-sync", // [prebuilt: .node files] Native synchronous zlib bindings
  "snappy", // [prebuilt: napi-rs platform deps] Native Snappy compression
  "@napi-rs/snappy", // [prebuilt: napi-rs platform deps] N-API Snappy bindings
  "lz4-napi", // [prebuilt: napi-rs platform deps] N-API LZ4 bindings (napi-rs powered)
  "msgpackr-extract", // [prebuilt: napi-rs platform deps] Native msgpack extraction
  "@mongodb-js/zstd", // [gyp] Native zstd bindings used by MongoDB ecosystem

  // Tooling / Build
  "deasync", // [prebuilt: .node files] Native event loop de-async
  "node-sass", // [prebuilt: .node files] Native libsass bindings
  "@parcel/watcher", // [prebuilt: napi-rs platform deps] Native filesystem watcher
  "@parcel/source-map", // [prebuilt: .node files] Native source map processing
  "@swc/core", // [prebuilt: napi-rs platform deps] Rust-based SWC compiler
  "esbuild", // [prebuilt: napi-rs platform deps] Go-based bundler with native binaries
  "lightningcss", // [prebuilt: napi-rs platform deps] Rust-based CSS parser/transformer
  "@biomejs/biome", // [prebuilt: napi-rs platform deps] Rust-based linter/formatter
  "tree-sitter", // [gyp] Native parser generator
  "re2", // [prebuilt: .node files] Native Google RE2 regex engine
  "onnxruntime-node", // [prebuilt: .node files] Native ONNX runtime bindings

  // System / Platform
  "edge-js", // [prebuilt: .node files] Native .NET CLR interop
  "fsevents", // [not installable] Native macOS filesystem events
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

  // FFI
  "ffi-napi", // [prebuilt: prebuilds dir] N-API foreign function interface
  "ref-napi", // [prebuilt: prebuilds dir] N-API native pointer/reference handling
  "ref-struct-napi", // [prebuilt: .node files] N-API native struct type support
  "ref-union-napi", // [prebuilt: .node files] N-API native union type support

  // Networking
  "grpc", // [gyp] Native gRPC bindings
  "zeromq", // [prebuilt: .node files] Native ZeroMQ bindings
  "unix-dgram", // [prebuilt: .node files] Native Unix datagram sockets
  "ssh2", // [prebuilt: .node files] Optional native crypto bindings
  "aws-crt", // [prebuilt: .node files] Native AWS Common Runtime bindings

  // XML / Parsing
  "libxmljs2", // [prebuilt: .node files] Native XML parser
  "node-expat", // [prebuilt: .node files] Native XML SAX parser

  // ML / AI
  "@xenova/transformers", // [prebuilt: .node files] "@llama-node/llama-cpp", // [prebuilt: .node files] "@huggingface/transformers", // [prebuilt: native transitive dep] // [prebuilt: .node files] Other
  "bufferutil", // [prebuilt: prebuilds dir] Native WebSocket buffer operations
  "utf-8-validate", // [prebuilt: prebuilds dir] Native UTF-8 validation
  "keytar", // [prebuilt: .node files] Native OS keychain access
  "iconv", // [prebuilt: .node files] Native character encoding (not iconv-lite)
  "nodegit", // [prebuilt: .node files] Native Git bindings
  "@sentry/profiling-node", // [prebuilt: native transitive dep] Native V8 profiling bindings
  "@napi-rs/clipboard", // [prebuilt: napi-rs platform deps] N-API clipboard access
  "better-sqlite3-multiple-ciphers", // [gyp] Encrypted SQLite variant
  "cbor-extract", // [prebuilt: napi-rs platform deps] Native CBOR extraction
  "diskusage", // [prebuilt: .node files] Native disk usage stats
  "nsfw", // [gyp] Native file watcher
  "native-reg", // [prebuilt: prebuilds dir] Native Windows registry access
  "integer", // [gyp] Native 64-bit integer support
  "md4x/napi", // [prebuilt: .node files] N-API bindings for markdown rendering
  "node-web-audio-api", // [prebuilt: .node files] Native Web Audio API implementation
  "@appsignal/nodejs", // [prebuilt: .node files] Native AppSignal APM agent
  "@statsig/statsig-node-core", // [prebuilt: napi-rs platform deps] Native Statsig feature flag SDK
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
  "playwright-core", // Dynamic __dirname-based resolution for browser connection
  "puppeteer-core", // Dynamic browser protocol resolution
  "vscode-oniguruma", // Uses .wasm
  "tslib", // Often problematic when bundled

  // Module hooking
  "@highlight-run/node", // Observability SDK; depends on require-in-the-middle
  "import-in-the-middle", // Monkey-patches ESM loader hooks
  "require-in-the-middle", // Monkey-patches require() at runtime
];
