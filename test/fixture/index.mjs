import depA from "@fixture/nitro-dep-a";
import depB from "@fixture/nitro-dep-b";
import depLib from "@fixture/nitro-lib";
import subpathLib from "@fixture/nitro-lib/subpath";
import extraUtils from "@fixture/nitro-utils/extra";

// fileURLToPath(new URL("node_modules/@fixture/nitro-utils/extra2.mjs", import.meta.url))
// import extraUtilsAbsolute from "#fixture-nitro-utils-extra-absolute";

export default {
  depA, // expected to all be 1.0.0
  depB, // expected to all be 2.0.1
  depLib, // expected to all be 2.0.0
  subpathLib, // expected to 2.0.0
  extraUtils, // expected @fixture/nitro-utils/extra
  // extraUtilsAbsolute,
};
