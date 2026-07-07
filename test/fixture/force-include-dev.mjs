// The app never statically imports `@fixture/force-included-dev`; it is
// force-traced via `traceInclude`. That package ships a runtime entry and a
// dev-only `build.config.mjs`; only the former's imports should be followed.
export default "app";
