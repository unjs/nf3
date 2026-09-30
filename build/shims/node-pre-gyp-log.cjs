// Replaces the contents of `@mapbox/node-pre-gyp/lib/util/log.js` to drop consola
// (only used for an info message in `napi.js`).

module.exports = { info() {}, warn() {} };
