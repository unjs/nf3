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
]);

/**
 * Packages that must be externalized (traced as dependencies) rather than bundled,
 * due to bundler compatibility issues with their module format or dynamic imports.
 */
export const NonBundleablePackages = [
  // Database drivers / ORMs
  "pg", // CJS module incompatible with Rollup/Rolldown bundling
  "pg-native", // Dynamic native binary loading companion to pg
  "mysql2", // CJS with optional native bindings loading
  "oracledb", // Dynamic native binary loading
  "tedious", // TDS protocol driver with CJS dynamic patterns
  "sequelize", // Dynamic requires that cannot be statically analyzed
  "knex", // Dynamic require() for dialect drivers
  "typeorm", // Dynamic entity/driver loading via require()
  "@mikro-orm/core", // Dynamic entity discovery and driver loading
  "mongoose", // Dynamic plugin loading patterns
  "prisma", // CLI with engine binaries and __dirname usage
  "@prisma/client", // CJS module using __dirname incompatible with Rollup/Rolldown bundling
  "mongodb", // Optional/native compressors and runtime driver resolution
  "redis", // Node-redis package exports and dynamic command table loading

  // APM / Observability
  "@sentry/node", // Sentry SDK should not be bundled
  "@sentry/node-core", // Sentry SDK should not be bundled
  "@sentry/nuxt", // Sentry SDK should not be bundled
  "@sentry/tanstackstart-react", // Vite export from SDK breaks build
  "dd-trace", // Datadog APM; require hooks and monkey-patching
  "newrelic", // New Relic agent; monkey-patches core modules via dynamic requires
  "applicationinsights", // Azure APM; monkey-patching and dynamic requires
  "@opentelemetry/instrumentation", // Dynamic require() hooks for auto-instrumentation

  // Cloud SDKs
  "aws-sdk", // Massive dynamic require() tree for service clients
  "firebase-admin", // gRPC + dynamic requires for service modules
  "@google-cloud/storage", // CJS + transitive dynamic loading in auth/gaxios stack
  "@azure/storage-blob", // CJS package often safer externalized in server bundles

  // Auth / Crypto
  "passport", // Dynamic strategy loading via require()
  "jsonwebtoken", // CJS with optional native crypto bindings
  "bcryptjs", // Pure JS but often paired with native bcrypt; CJS interop issues

  // Templating / Rendering
  "ejs", // Dynamic include/require patterns
  "pug", // Dynamic filter/plugin loading
  "handlebars", // Dynamic helper/partial registration

  // Email
  "nodemailer", // Dynamic transport loading and CJS patterns

  // GraphQL
  "graphql", // Must be a singleton; bundling causes duplicate schema issues
  "apollo-server-express", // Dynamic plugin/transport loading

  // Serverless / Runtime
  "@netlify/functions", // Runtime context injection; should stay external
  "@vercel/node", // Runtime helpers that expect external resolution

  // Logging / Queues
  "bunyan", // Stream-based transports with dynamic loading
  "bull", // Redis-backed queue with dynamic requires
  "bullmq", // Modern Bull queue; Lua scripts and worker file paths

  // Other
  "@discordjs/ws", // Optional dependency breaks build
  "pino", // Worker thread transports reference file paths at runtime
  "winston", // Transport loading patterns and CJS interop edge-cases
  "socket.io", // Engine.IO parser/transports and CJS runtime indirection
  "puppeteer", // Downloads Chromium binary; __dirname-based resolution
  "playwright", // Downloads browser binaries; dynamic binary resolution
  "sharp", // Also non-bundleable due to platform-specific binary loading
  "undici", // Node built-in fetch backend; CJS with WASM loading
  "express", // Deeply CJS; safer externalized in serverless bundles
  "fastify", // Plugin loading system with dynamic requires
  "nest", // NestJS dynamic module/provider loading
  "@nestjs/core", // Dynamic module/provider loading via reflect-metadata
  "@nestjs/common", // Companion to @nestjs/core
  "mikro-orm", // Alias for @mikro-orm packages
  "nock", // HTTP interception via monkey-patching
  "msw", // Mock Service Worker; interceptor patterns
];
