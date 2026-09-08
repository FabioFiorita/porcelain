# Development

## Bootstrap

Use Node 24.20.0 LTS (`.node-version`) and pnpm 12.3.4 (`packageManager`). Node 26.8.1+ is also
accepted for local work; CI uses the pinned LTS baseline. With Node available:

```sh
npx --yes pnpm@12.3.4 install --frozen-lockfile
```

Use the pinned pnpm version, not an unrelated globally installed version. Commands below assume
that version is available as `pnpm`; `npx --yes pnpm@12.3.4 <command>` is the equivalent fallback.

## Codex worktrees

`.codex/environments/environment.toml` installs locked dependencies when Codex creates a worktree.
Setup does not launch servers or run the full check suite. Node must already meet the declared engine
requirement. If setup was skipped, run the bootstrap command above from the worktree.

## Fast local loop

```sh
pnpm exec biome check --write scripts/boundary-rules.ts
pnpm exec vitest run scripts/boundary-rules.spec.ts
pnpm exec tsc --noEmit
```

As packages appear, run their focused specs and typecheck scripts. Contract changes include affected
consumers. Do not run repository-wide checks after every edit. Fix failures with focused reproductions.
There are no commit hooks; local checks are explicit, while CI owns comprehensive verification.

## CI gate

`pnpm verify` runs full format, lint, types, dependency boundaries, Knip, and specs with coverage.
It is available locally for diagnosing gates and validating tooling changes; routine feature work
uses the focused loop. CI splits static checks and coverage tests into independent jobs and cancels
superseded PR runs. Pull requests and pushes to `main` or `codex/porcelain-rebuild` trigger checks.
Failures upload test/coverage evidence where produced. GitHub branch protection must separately
require these jobs before merge; writing YAML does not configure repository protection.

## Quality standards

The convention gate rejects `let` and `var` declarations in `apps/*/src` and
`packages/*/src`, including JavaScript/TypeScript module and JSX variants. Colocated specs,
ambient declaration files, and tooling are excluded. It parses syntax with the pinned stable
TypeScript parser alias; it does not scan comments or string contents. Production exceptions
require a reviewed gate change, not an inline bypass. This enforces declaration style, not deep
immutability: object fields and collection mutation still require review.

Index modules and `.test.*` filenames are rejected by the same gate. Biome owns explicit-any,
ignored TypeScript errors, focused/skipped tests, and naming checks; TypeScript owns unused locals,
unused parameters, and type correctness. Keep these mechanical details in the owning checks.

Required checks have zero type, lint, dependency-boundary, convention, and Knip findings. Biome limits
cognitive complexity to 15; dependency-cruiser rejects cycles and forbidden dependencies. Cognitive
complexity measures understandability of control flow, not coupling. Do not add overlapping complexity
scores simply to increase the number of metrics.

Coverage minimums are 90% statements, 90% lines, 85% functions, and 80% branches, rounded below the
initial behavior-backed baseline. Do not lower them to pass a change or write incidental assertions to
raise a score. Review uncovered behavior and test value. Vitest emits JUnit, HTML coverage, LCOV, and
JSON summaries; CI uploads reports separately for Linux and macOS. Knip checks unused files, exports,
and dependencies using actual application/config/test entry points, not every source file as an entry.

fast-check properties run with Vitest and protect identity invariants across generated scenarios.
Failures report their seed and shrink path for reproduction. Mutation testing is deferred to a scoped
CI pilot for reconciliation: measure its runtime and inspect surviving mutants before setting a useful
threshold. Neither mutation scores nor coverage replace a fresh architectural and behavioral review.

Repeatable integration specs currently cover real Git/SQLite, lifecycle cancellation, and loopback HTTP.
Browser, Electron, mobile runtime, packaging, and remote connectivity need their own smoke checks when
introduced. The CI matrix runs server tests on Linux and macOS with the pinned Node version; writing
that matrix is not proof that either cloud run has passed.

Tests must be named `.spec.ts`/`.spec.tsx`; current test discovery and source inclusion are in
`vitest.config.ts`. New application test projects and TypeScript configurations must be wired into
CI when created, with no silent fallback to passing empty suites.

pnpm workspaces currently suffice for the tooling foundation. Revisit Turborepo when multiple
application/packages have tasks: dependency ordering and caching should earn their setup cost.
Cached builds do not establish runtime behavior, and Turbo does not change which checks run locally.

## Server inventory

`openApplication` in `apps/server/src/app.ts` opens an explicitly supplied absolute data directory,
refreshes registered repositories, and returns the named `Application` API: `inventory`, `register`, `refresh`, and `close`.
Registration returns `{ project, issues }`; refresh returns `{ inventory, issues }`. Diagnostics belong to each operation result; startup refresh does not retain them on the application.
The caller must close the application. There is no default production directory or network listener.
Use only temporary repositories and state for development fixtures.

```sh
pnpm exec vitest run apps/server/src
pnpm --filter @porcelain/contracts --filter @porcelain/server typecheck
pnpm exec biome check apps/server
```

These specs exercise real Git and SQLite, including restart, moves, removal, and unavailable paths.
Fastify specs also exercise response serialization and a disposable loopback health request. They do
not prove client workflows or remote connections. CI runs them on Linux and macOS;
a local macOS pass does not establish Linux behavior until that CI run is observed.

## Persistence and HTTP infrastructure

`apps/server/src/db/schema` owns named Drizzle table definitions. Generate migrations:

```sh
pnpm --filter @porcelain/server db:generate
```

Review and commit SQL, snapshots, and the migration journal under `apps/server/drizzle`. Data transformations may need
explicit SQL. Application startup applies pending migrations; do not use `drizzle-kit push` to upgrade
application data. The initial relational migration is the supported baseline. Earlier development schemas are rejected
without modification; use a new disposable development directory or explicitly recover the old data.
Keep the migration directory with the server when adding build/packaging tasks.

`createServer` in `apps/server/src/http/server.ts` requires a configured bearer token and returns a Fastify instance with public `GET /health`,
authenticated inventory routes, and a shutdown
hook for inventory. It does not bind a port. The health contract is exported from
`@porcelain/contracts/health`; the server uses the Fastify Zod provider. The [inventory HTTP decision](decisions/0004-inventory-http.md) defines routes, token requirements,
and public errors. Binding, TLS, token provisioning, and client connection behavior remain startup work.

The server uses stable Drizzle with `better-sqlite3`, which bundles native prebuilds. Its automatic
build is disabled in pnpm; runtime tests must prove that the bundled binary loads. Validate installation
on the pinned CI Node version and include the native driver assets in future packaging checks.

## Operation lifecycle

Settings are parsed by the Zod schema in `src/config/application-settings.ts`. Application operations
have a default 30-second deadline including queue wait, with an optional caller AbortSignal. Shutdown
rejects new operations, aborts queued/active work, waits for it to unwind, and closes persistence once.
Injected Git adapters must honor cancellation; code checks signals again before persistence. Existing
synchronous SQLite transactions and filesystem calls cannot be preempted mid-call.

Registration discovers its target and only refreshes existing projects with overlapping checkout paths.
An explicit refresh or startup refresh inspects all registered projects. Expected repository failures
mark affected entries unavailable and return their original errors alongside that operation’s result. Missing Git executables, timeouts, cancellation, and unexpected failures propagate. These
internal diagnostics are not a public response schema and must not be sent directly to remote clients.
Refresh commits each project independently; cancellation does not undo already completed project updates.
