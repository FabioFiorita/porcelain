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

`pnpm verify` runs full format, lint, types, dependency boundaries, and specs with coverage.
It is available locally for diagnosing gates and validating tooling changes; routine feature work
uses the focused loop. CI splits static checks and coverage tests into independent jobs and cancels
superseded PR runs. Pull requests and pushes to `main` or `codex/porcelain-rebuild` trigger checks.
Failures upload test/coverage evidence where produced. GitHub branch protection must separately
require these jobs before merge; writing YAML does not configure repository protection.

Coverage starts as a report, not a correctness claim or arbitrary percentage gate. Add thresholds
when meaningful feature tests establish a baseline. Mutation checks for critical rules, UI smoke,
visual regression, and native platform lanes are added with their first applicable behavior.
No current job proves browser, Electron, mobile runtime, packaging, or remote connectivity.

Tests must be named `.spec.ts`/`.spec.tsx`; current test discovery and source inclusion are in
`vitest.config.ts`. New application test projects and TypeScript configurations must be wired into
CI when created, with no silent fallback to passing empty suites.

pnpm workspaces currently suffice for the tooling foundation. Revisit Turborepo when multiple
application/packages have tasks: dependency ordering and caching should earn their setup cost.
Cached builds do not establish runtime behavior, and Turbo does not change which checks run locally.

## Server inventory

`openApplication` in `apps/server/src/app.ts` opens an explicitly supplied absolute data directory,
refreshes registered repositories, and returns `inventory`, `register`, `refresh`, and `close` operations.
The caller must close the application. There is no default production directory or network listener.
Use only temporary repositories and state for development fixtures.

```sh
pnpm exec vitest run apps/server/src
pnpm --filter @porcelain/contracts --filter @porcelain/server typecheck
pnpm exec biome check apps/server
```

These specs exercise real Git and SQLite, including restart, moves, removal, and unavailable paths.
Fastify specs also exercise response serialization and a disposable loopback health request. They do
not prove client workflows or remote connections. CI runs them on Linux;
a local macOS pass does not establish Linux behavior until that CI run is observed.

## Persistence and HTTP infrastructure

`apps/server/src/db/schema` owns named Drizzle table definitions. Generate migrations:

```sh
pnpm --filter @porcelain/server db:generate
```

Review and commit SQL, snapshots, and the migration journal under `apps/server/drizzle`. Data transformations may need
explicit SQL. Application startup applies pending migrations; do not use `drizzle-kit push` to upgrade
application data. The version-1 migration preserves IDs and rolls back invalid source data.
Keep the migration directory with the server when adding build/packaging tasks.

`createServer` in `apps/server/src/http/server.ts` returns a Fastify instance with `GET /health` and a shutdown
hook for inventory. It does not bind a port. The health contract is exported from
`@porcelain/contracts/health`; the server uses the Fastify Zod provider. There are no inventory routes
or credentials. Choose authentication, binding, and connection behavior before adding those routes.

The server uses stable Drizzle with `better-sqlite3`, which bundles native prebuilds. Its automatic
build is disabled in pnpm; runtime tests must prove that the bundled binary loads. Validate installation
on the pinned CI Node version and include the native driver assets in future packaging checks.
