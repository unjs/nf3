// The app statically imports `@fixture/mv-dep` at v2.0.0 (hoisted at the top
// level), while `@fixture/force-included-mv` — pulled in only via `traceInclude`
// — depends on `@fixture/mv-dep` at v1.0.0 (nested). This makes `mv-dep`
// multi-version, exercising the dedup path where the force-included package must
// be attributed as the parent of its own runtime dependency.
import dep from "@fixture/mv-dep";

export default dep;
