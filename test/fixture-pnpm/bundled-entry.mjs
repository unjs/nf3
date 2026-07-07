// Simulates the app AND its declaring package (`@fixture/pnpm-app`) being
// *bundled* rather than externalized: nothing here becomes a traced package, so
// `pnpm-app` never contributes a declarer root. The nested native dep it depends
// on can therefore only be resolved when its declarer root is supplied via
// `traceIncludeRoots`. See test/pnpm.test.ts.
export default "bundled";
