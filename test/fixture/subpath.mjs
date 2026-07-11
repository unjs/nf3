// Regression fixture for https://github.com/unjs/nf3/issues/60
// The app never statically imports the native package; it enters the output
// solely through a *subpath* `traceInclude` entry (`@fixture/subpath-native/sub`).
export default "app";
