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
Husky runs React Doctor against staged web source before commits and blocks warnings or errors.
Run `pnpm check:react` for the full React scan; CI runs the same pinned check.
`pnpm install` installs the hook through the prepare script. Other local checks remain explicit.
React Doctor runs locally with telemetry and remote supply-chain scoring disabled; pnpm owns
dependency policy. Vendored shadcn components and its generated mobile hook are excluded,
matching the vendor policy. Application React rules are not suppressed.

## CI gate

`pnpm verify` runs full format, lint, types, dependency boundaries, Knip, React Doctor, and specs with coverage, followed by the web browser smoke.
It is available locally for diagnosing gates and validating tooling changes; routine feature work
uses the focused loop. CI splits static checks, coverage tests and the web browser smoke into independent jobs and cancels
superseded PR runs. Pull requests and pushes to `main` or `codex/porcelain-rebuild` trigger checks.
Failures upload test/coverage evidence where produced. GitHub branch protection must separately
require these jobs before merge; writing YAML does not configure repository protection.

## Quality standards

The convention gate rejects `let` and `var` declarations in `apps/*/src` and
`packages/*/src`, including JavaScript/TypeScript module and JSX variants. Colocated specs,
ambient declaration files, tooling and vendored shadcn UI files are excluded. It parses syntax with the pinned stable
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
The built web shell has a Chromium smoke at desktop and narrow widths.
Electron, mobile runtime, packaging, and remote connectivity need their own smoke checks when
introduced. The CI matrix runs server tests on Linux and macOS with the pinned Node version; writing
that matrix is not proof that either cloud run has passed.

Tests must be named `.spec.ts`/`.spec.tsx`; current test discovery and source inclusion are in
`vitest.config.ts`. New application test projects and TypeScript configurations must be wired into
CI when created, with no silent fallback to passing empty suites.

pnpm owns workspace dependencies. Turborepo caches package typechecks and separate contracts, Git, server, and tooling
coverage tasks. Use `pnpm typecheck` and `pnpm test:coverage` so runtime fingerprinting runs first.
Server tests depend on Git tests and dependency typechecks. Root lint, formatting, boundaries and Knip
remain whole-repository checks. CI restores `.turbo/cache` separately by OS, architecture and toolchain lock.
The [package and cache decision](decisions/0006-git-package-and-task-cache.md) defines invalidation.

Coverage JSON uses repository-relative paths before caching. The always-run merger combines cached
and fresh file coverage, generates `coverage/combined` reports, and enforces the same global thresholds.
Package reports live in their own `coverage` directories; missing or empty reports fail. Contracts have their own specs and are also exercised by server integration tests; a scope-ownership spec rejects newly added specs without a task.
No empty placeholder test tasks are created. Deployment connectivity checks must run against the live
endpoint and must not reuse cached proof. Node, Git and OpenSSL must be installed for cached checks.

## Server development

The [application port](../apps/server/src/application.ts) defines the current operations;
[composition](../apps/server/src/app.ts) shows how dependencies and lifecycle are wired.
Use the interactive API playground below for the generated HTTP schemas and executable examples.
These sources own the API inventory; this guide does not repeat their method lists.

Use temporary repositories and explicitly supplied disposable state. Callers opening an application
or server are responsible for closing it. Choose colocated specs for the behavior being changed;
include affected contract consumers in type checks. Local integration checks do not establish browser,
Electron, mobile, or remote deployment behavior.

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

The [server factory](../apps/server/src/http/server.ts) owns HTTP composition and shutdown hooks.
Use its route schemas and generated OpenAPI document for requests, responses, and authentication
requirements. The [local startup decision](decisions/0005-local-server-startup.md) explains the
executable lifecycle. TLS, token provisioning, and client connections require separate integration proof.

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

## Run the local server

Supply all three environment variables, then run the server from this checkout:

```sh
PORCELAIN_DATA_DIRECTORY="$(mktemp -d)" \
PORCELAIN_PORT=0 \
PORCELAIN_TOKEN="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64url"))')" \
pnpm --filter @porcelain/server start
```

This example creates disposable state and a random token; for authenticated API calls, supply a
caller-managed token through `PORCELAIN_TOKEN`. Never use installed application data or credentials
as fixtures. The server binds only to `127.0.0.1`; port 0 selects an available port. Its JSON stdout
line reports the listening address. The token is never printed. Use SIGINT/Ctrl-C or SIGTERM for
clean shutdown, and remove your disposable directory once its server has stopped.

Only one executable may own a data directory. If startup reports an ownership file after a crash,
inspect `server.lock` in that exact directory and establish that the owner has stopped. The recorded
PID alone does not prove process identity or liveness. Only then remove `server.lock` and retry;
retain the database and migration data. Never remove the file while a server still owns it.

Run the process smoke and startup specs with:

```sh
pnpm exec vitest run apps/server/src/main.spec.ts apps/server/src/lifecycle/start-local-server.spec.ts
```

## Git action verification

The [Git action decision](decisions/git-action-contracts.md) defines supported mutation profiles,
preparation/receipt recovery, external-writer limits and explicit stash scope. Run the focused action
Git, receipt, use-case and HTTP specs when changing this boundary. Fixtures use isolated HOME/config,
temporary repositories and local remotes; HTTPS fixtures generate disposable certificates using OpenSSL.
SSH transport substitutes prove invocation policy, not real authentication interoperability.

## Interactive API playground

From the repository root, run:

```sh
node apps/server/src/development/playground.ts
```

Run Node directly so it receives terminal signals and can finish cleanup before exiting.
Open the printed `documentation` URL. This starts
Swagger UI and a loopback server with a temporary database, a sample repository,
a linked `review` worktree, two commits, staged and unstaged changes, an untracked
file, and a local bare remote. No external Git account is required.

Read the printed `tokenFile`, click **Authorize**, and paste its contents without
the `Bearer` prefix. Swagger adds that prefix. Authorization is not persisted
across page reloads. Expand an operation, click **Try it out**, fill its inputs,
and click **Execute** to see the actual response.

A useful first walkthrough:

1. Execute `GET /inventory`. The printed `worktreeId` identifies the review worktree.
2. Use that ID in Files, Changes and History to inspect the seeded repository.
3. In Comments, execute the example POST body, then GET to read the discussion.
   Copy the returned thread ID to reply or resolve it.
4. Try a file preference to pin or hide `README.md`, or upload the example artifact.
5. For a Git write, prepare the action, use its returned preparation ID in the
   corresponding execute request with a fresh UUID request ID, then poll its receipt.
   Stash creation supports `includeUntracked: true` for the sample `notes.txt`.

These are real API operations. The playground is disposable, not a filesystem
sandbox: keep its registered projects limited to the generated examples.
Project registration discovers existing worktrees; there is no API to create a
worktree. Press Ctrl+C to close the server and remove its temporary data. A new
run starts with fresh IDs and a fresh token.

For another development server, set `PORCELAIN_API_DOCUMENTATION=1` to enable
`/documentation/` and `/documentation/json`. Documentation is disabled by default;
`0` explicitly disables it. When enabled, the explorer and schema are public,
while application operations still require the server's bearer token.

## Spec organization

Use an outer `describe` to name the subject in larger specs. Group related cases
under behavior names when this makes the report easier to scan, for example
history pagination or stash creation. Keep small specs shallow. Grouping should
not introduce shared mutable fixtures or replace independent, meaningful tests.


## Web development

Run `pnpm dev:web` for Vite on <http://127.0.0.1:5173> with React refresh.
Run `pnpm --filter @porcelain/web build` to typecheck and produce static assets.
The initial shell does not connect to an environment yet.

Install the smoke browser once with
`pnpm --filter @porcelain/web exec playwright install --with-deps chromium`,
then run `pnpm test:web:smoke`. The test owns a production preview on port 4173
and fails if that port is occupied. It builds its own assets and runs uncached.
Browser specs live under `apps/web/e2e`; Playwright owns them, while
`scripts/test-configuration.ts` enforces ownership alongside Vitest scopes.
See the [web foundation decision](decisions/web-foundation.md) for the vendor policy.
