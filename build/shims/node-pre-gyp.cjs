// Replaces the contents of `@mapbox/node-pre-gyp/lib/node-pre-gyp.js` (relative requires
// resolve from there).
//
// @vercel/nft only uses `find()`. This skips the CLI (`Run`, nopt, command loader,
// package.json) and consola.

const fs = require("node:fs");
const path = require("node:path");
const versioning = require("./util/versioning.js");
const napi = require("./util/napi.js");

// Same as lib/pre-binding.js find()
exports.find = function find(package_json_path, opts) {
  if (!fs.existsSync(package_json_path)) {
    throw new Error(package_json_path + "does not exist");
  }
  const package_json = JSON.parse(fs.readFileSync(package_json_path, "utf8"));

  // Same as Run#setBinaryHostProperty() (host does not affect the binary path)
  const binary = package_json.binary;
  if (binary && !binary.host && binary.staging_host && binary.production_host) {
    const s3Host = process.env.node_pre_gyp_s3_host;
    binary.host = binary[s3Host === "staging" ? "staging_host" : "production_host"];
  }

  versioning.validate_config(package_json, opts);
  let napi_build_version;
  if (napi.get_napi_build_versions(package_json, opts)) {
    napi_build_version = napi.get_best_napi_build_version(package_json, opts);
  }
  opts = opts || {};
  if (!opts.module_root) opts.module_root = path.dirname(package_json_path);
  return versioning.evaluate(package_json, opts, napi_build_version).module;
};
