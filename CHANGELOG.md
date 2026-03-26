# Changelog

## v0.3.14

[compare changes](https://github.com/unjs/nf3/compare/v0.3.13...v0.3.14)

### 🩹 Fixes

- Add `@takumi-rs/core` to `NodeNativePackages` ([#31](https://github.com/unjs/nf3/pull/31))
- Add zigpty and md4x to node native pkgs ([ce71d9a](https://github.com/unjs/nf3/commit/ce71d9a))

### 🏡 Chore

- Updatre deps ([1145043](https://github.com/unjs/nf3/commit/1145043))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))
- Kane Wang ([@yeecord](https://github.com/yeecord))

## v0.3.13

[compare changes](https://github.com/unjs/nf3/compare/v0.3.12...v0.3.13)

### 🩹 Fixes

- **trace:** Avoid shared reference mutation in applyProductionCondition ([fb3eac2](https://github.com/unjs/nf3/commit/fb3eac2))
- **trace:** Improve multi-version hoisting to prefer most dependants ([328dbc1](https://github.com/unjs/nf3/commit/328dbc1))

### 🏡 Chore

- Add agents.md ([9576a4e](https://github.com/unjs/nf3/commit/9576a4e))
- Apply automated updates ([6ab2c2a](https://github.com/unjs/nf3/commit/6ab2c2a))

### ✅ Tests

- Add unit tests with mocking ([c775422](https://github.com/unjs/nf3/commit/c775422))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v0.3.12

[compare changes](https://github.com/unjs/nf3/compare/v0.3.11...v0.3.12)

### 🚀 Enhancements

- Add `fullTraceInclude` option ([#4](https://github.com/unjs/nf3/pull/4))

### 🩹 Fixes

- **plugin:** Use `traceInclude` ([#27](https://github.com/unjs/nf3/pull/27))

### 🏡 Chore

- Update deps ([7763d5a](https://github.com/unjs/nf3/commit/7763d5a))
- Apply automated updates ([9bcf4ae](https://github.com/unjs/nf3/commit/9bcf4ae))

### ❤️ Contributors

- Andrew Lisowski ([@hipstersmoothie](https://github.com/hipstersmoothie))
- Pooya Parsa ([@pi0](https://github.com/pi0))
- Peterhirn <peter+github@lope.at>

## v0.3.11

[compare changes](https://github.com/unjs/nf3/compare/v0.3.10...v0.3.11)

### 🩹 Fixes

- **plugin:** Use `writeBundle` hook to avoid vite `emptyOutDir` race ([#26](https://github.com/unjs/nf3/pull/26))
- **db:** Only keep tested packages in `NonBundleablePackages` ([#23](https://github.com/unjs/nf3/pull/23))

### 🏡 Chore

- Update deps ([5f982a9](https://github.com/unjs/nf3/commit/5f982a9))
- Update deps ([b4ea594](https://github.com/unjs/nf3/commit/b4ea594))
- Update test ([4b3fc22](https://github.com/unjs/nf3/commit/4b3fc22))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))
- Kricsleo ([@kricsleo](https://github.com/kricsleo))

## v0.3.10

[compare changes](https://github.com/unjs/nf3/compare/v0.3.9...v0.3.10)

### 🩹 Fixes

- **db:** Remove extra items ([704c5fd](https://github.com/unjs/nf3/commit/704c5fd))

### 🏡 Chore

- Ref to `THIRD-PARTY-LICENSES` ([d9485d8](https://github.com/unjs/nf3/commit/d9485d8))
- Update deps ([86589d8](https://github.com/unjs/nf3/commit/86589d8))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v0.3.9

[compare changes](https://github.com/unjs/nf3/compare/v0.3.8...v0.3.9)

### 🚀 Enhancements

- Update database ([e06a583](https://github.com/unjs/nf3/commit/e06a583))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v0.3.8

[compare changes](https://github.com/unjs/nf3/compare/v0.3.7...v0.3.8)

### 🚀 Enhancements

- **db:** Add sentry sdk to NonBundleablePackages ([#21](https://github.com/unjs/nf3/pull/21))

### 🏡 Chore

- Update deps ([22e141a](https://github.com/unjs/nf3/commit/22e141a))
- Add pnpm config ([f97c813](https://github.com/unjs/nf3/commit/f97c813))
- Apply automated updates ([f02de7e](https://github.com/unjs/nf3/commit/f02de7e))
- Migrate to oxfmt and oxlint ([7d4ca5a](https://github.com/unjs/nf3/commit/7d4ca5a))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))
- Andrei ([@andreiborza](https://github.com/andreiborza))

## v0.3.7

[compare changes](https://github.com/unjs/nf3/compare/v0.3.6...v0.3.7)

### 🩹 Fixes

- Add `@discordjs/ws` to `NonBundleablePackages` ([#17](https://github.com/unjs/nf3/pull/17))
- Add @prisma/client to NonBundleablePackages ([#18](https://github.com/unjs/nf3/pull/18))

### 🏡 Chore

- Update deps ([32d2ac1](https://github.com/unjs/nf3/commit/32d2ac1))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))
- Katja Lutz <apps@katjalutz.ch>
- Rihan Arfan ([@RihanArfan](https://github.com/RihanArfan))

## v0.3.6

[compare changes](https://github.com/unjs/nf3/compare/v0.3.5...v0.3.6)

### 🚀 Enhancements

- **db:** Add `NonBundleablePackages` ([f28708d](https://github.com/unjs/nf3/commit/f28708d))

### 💅 Refactors

- Add `zlib-sync` to native db ([ecd1745](https://github.com/unjs/nf3/commit/ecd1745))

### 🏡 Chore

- Update deps ([77b38db](https://github.com/unjs/nf3/commit/77b38db))
- Update deps ([72809bc](https://github.com/unjs/nf3/commit/72809bc))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v0.3.5

[compare changes](https://github.com/unjs/nf3/compare/v0.3.4...v0.3.5)

### 📦 Build

- Exclude tracing `typescript` ([65e84ff](https://github.com/unjs/nf3/commit/65e84ff))

### 🏡 Chore

- Update deps ([48cedc5](https://github.com/unjs/nf3/commit/48cedc5))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v0.3.4

[compare changes](https://github.com/unjs/nf3/compare/v0.3.3...v0.3.4)

### 🏡 Chore

- Update deps ([a2f15bf](https://github.com/unjs/nf3/commit/a2f15bf))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v0.3.3

[compare changes](https://github.com/unjs/nf3/compare/v0.3.2...v0.3.3)

### 📦 Build

- Export lighter `/db` subpath ([f18b52b](https://github.com/unjs/nf3/commit/f18b52b))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v0.3.2

[compare changes](https://github.com/unjs/nf3/compare/v0.3.1...v0.3.2)

### 🚀 Enhancements

- Node native packages db ([44385f8](https://github.com/unjs/nf3/commit/44385f8))

### 📦 Build

- Directly read/write package.json ([e71ec96](https://github.com/unjs/nf3/commit/e71ec96))

### 🏡 Chore

- Update deps ([9e5b1c0](https://github.com/unjs/nf3/commit/9e5b1c0))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v0.3.0

[compare changes](https://github.com/unjs/nf3/compare/v0.2.0...v0.3.0)

### 🚀 Enhancements

- ⚠️ Rewrite plugin ([#14](https://github.com/unjs/nf3/pull/14))

### 🏡 Chore

- Apply automated updates ([c61a383](https://github.com/unjs/nf3/commit/c61a383))
- Update dependencies ([e0b1711](https://github.com/unjs/nf3/commit/e0b1711))
- Update build script ([e99969a](https://github.com/unjs/nf3/commit/e99969a))

#### ⚠️ Breaking Changes

- ⚠️ Rewrite plugin ([#14](https://github.com/unjs/nf3/pull/14))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v0.2.0

[compare changes](https://github.com/unjs/nf3/compare/v0.1.11...v0.2.0)

### 🩹 Fixes

- ⚠️ Prioritize string patterns over regexp ([97e764b](https://github.com/unjs/nf3/commit/97e764b))

#### ⚠️ Breaking Changes

- ⚠️ Prioritize string patterns over regexp ([97e764b](https://github.com/unjs/nf3/commit/97e764b))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v0.1.11

[compare changes](https://github.com/unjs/nf3/compare/v0.1.10...v0.1.11)

### 🩹 Fixes

- Prioritize regex matchers ([43ecddd](https://github.com/unjs/nf3/commit/43ecddd))

### 🏡 Chore

- Update deps ([40dd864](https://github.com/unjs/nf3/commit/40dd864))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v0.1.10

[compare changes](https://github.com/unjs/nf3/compare/v0.1.9...v0.1.10)

### 🔥 Performance

- Reduce `tryResolve` overhead ([c87d4ea](https://github.com/unjs/nf3/commit/c87d4ea))

### 🏡 Chore

- Update deps ([3311ee7](https://github.com/unjs/nf3/commit/3311ee7))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v0.1.9

[compare changes](https://github.com/unjs/nf3/compare/v0.1.8...v0.1.9)

### 🩹 Fixes

- Limit source exclude to .d.ts files ([8cb24fb](https://github.com/unjs/nf3/commit/8cb24fb))

### 🏡 Chore

- Apply automated updates ([50066d7](https://github.com/unjs/nf3/commit/50066d7))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v0.1.8

[compare changes](https://github.com/unjs/nf3/compare/v0.1.7...v0.1.8)

### 📦 Build

- Improve dist ([4c80956](https://github.com/unjs/nf3/commit/4c80956))

### 🏡 Chore

- Gitignore \*.tgz ([47b7fcf](https://github.com/unjs/nf3/commit/47b7fcf))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v0.1.7

[compare changes](https://github.com/unjs/nf3/compare/v0.1.6...v0.1.7)

### 🩹 Fixes

- Fix optional types ([58bebf6](https://github.com/unjs/nf3/commit/58bebf6))

### 🏡 Chore

- Update readme and build config ([e42985e](https://github.com/unjs/nf3/commit/e42985e))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v0.1.6

[compare changes](https://github.com/unjs/nf3/compare/v0.1.5...v0.1.6)

### 🚀 Enhancements

- Trace hooks ([#8](https://github.com/unjs/nf3/pull/8))
- Transform plugins ([#9](https://github.com/unjs/nf3/pull/9))

### 🩹 Fixes

- **plugin:** Exclude non js sources ([704c3d3](https://github.com/unjs/nf3/commit/704c3d3))

### 💅 Refactors

- Use `.nf3` for multi version dir ([3e3eeb6](https://github.com/unjs/nf3/commit/3e3eeb6))

### 📦 Build

- Manually exclude extra deps ([6638346](https://github.com/unjs/nf3/commit/6638346))
- Treeshake dist packages ([9ac9152](https://github.com/unjs/nf3/commit/9ac9152))
- Also minify `.cjs` in dist ([cf2b516](https://github.com/unjs/nf3/commit/cf2b516))

### 🏡 Chore

- Update build deps ([ee8a4a4](https://github.com/unjs/nf3/commit/ee8a4a4))
- Update lockfile ([997b345](https://github.com/unjs/nf3/commit/997b345))
- Update ci ([4d76c6c](https://github.com/unjs/nf3/commit/4d76c6c))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v0.1.5

[compare changes](https://github.com/unjs/nf3/compare/v0.1.4...v0.1.5)

### 📦 Build

- Run build script before publish ([a6e6311](https://github.com/unjs/nf3/commit/a6e6311))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v0.1.4

[compare changes](https://github.com/unjs/nf3/compare/v0.1.3...v0.1.4)

### 🩹 Fixes

- Skip resolving ids with protocol ([4b1eed1](https://github.com/unjs/nf3/commit/4b1eed1))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v0.1.3

[compare changes](https://github.com/unjs/nf3/compare/v0.1.2...v0.1.3)

### 🩹 Fixes

- Add order to `resolveId` and `buildEnd` hooks ([5831b74](https://github.com/unjs/nf3/commit/5831b74))

### 💅 Refactors

- Rename plugin ([ce8e792](https://github.com/unjs/nf3/commit/ce8e792))

### 🏡 Chore

- Update deps ([94860c3](https://github.com/unjs/nf3/commit/94860c3))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v0.1.2

[compare changes](https://github.com/unjs/nf3/compare/v0.1.1...v0.1.2)

### 🩹 Fixes

- Ignore `EEXIST` link errors ([c8d05d3](https://github.com/unjs/nf3/commit/c8d05d3))

### 🏡 Chore

- Apply automated updates ([13fad08](https://github.com/unjs/nf3/commit/13fad08))
- Update deps ([6ff203b](https://github.com/unjs/nf3/commit/6ff203b))
- Remove unused import ([ff72e4a](https://github.com/unjs/nf3/commit/ff72e4a))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v0.1.1

[compare changes](https://github.com/unjs/nf3/compare/v0.1.0...v0.1.1)

### 🩹 Fixes

- Write package.json to parent + opt-in ([3f52298](https://github.com/unjs/nf3/commit/3f52298))

### 🏡 Chore

- Add untracked fixture files ([4213403](https://github.com/unjs/nf3/commit/4213403))
- Fix typo in docs ([#3](https://github.com/unjs/nf3/pull/3))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))
- João Lucas De Oliveira Lopes ([@jlucaso1](https://github.com/jlucaso1))
