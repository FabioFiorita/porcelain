# 0001: An understandable TypeScript foundation

Status: accepted direction; package versions and executable checks are authoritative in configuration.

Use one language across server and clients to keep contracts, tooling, and contributions consistent.
Use plain TypeScript with explicit dependencies rather than Rust or Effect. Keep platform applications
separate while sharing contracts and client behavior across web and Expo. Electron hosts the web UI.

TypeScript 7 passed a bounded compatibility fixture. Use Node LTS for CI, pinned dependencies and
lockfile installs for reproducibility. Biome provides formatting, linting, cognitive-complexity and
naming checks; dependency-cruiser checks module boundaries/cycles; Vitest provides specs/coverage.
Cognitive complexity bounds control-flow difficulty, not responsibility count or proof of correctness.

Keep local iteration focused. Comprehensive CI and one bounded fresh review complement each other.
Do not install UI, server, persistence, or mutation libraries before their owning behavior needs them.
Future sessions should continue from product intent and enforceable boundaries, not reproduce old code.

## Toolchain compatibility

Type checking uses TypeScript 7.0.2. dependency-cruiser 18.2.0 requires the legacy compiler API;
a scoped pnpm package extension gives that tool TypeScript 6.0.3 solely for import analysis.
Do not switch application type checking to that internal dependency. Guard specs exercise actual
TypeScript imports, including prohibited edges, so a silently unavailable parser cannot pass.

`skipLibCheck` is enabled because current Vitest/Vite declaration files fail checking with exact
optional properties and reference incomplete upstream types. Application/tooling source remains
strictly checked, including exact optional properties and unchecked indexed access. This flag does
not validate third-party declarations; dependency upgrades still require compatibility checks.
