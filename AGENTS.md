# Porcelain

Porcelain is a review layer for agent-created work. The daemon owns the code,
worktrees, Git state, terminals, and review data; browser, Electron, and mobile are clients. It
is not an agent host or an IDE. The product is changing quickly, so current owner direction and
the code that ships outrank historical prose.

Optimize for a tight loop: understand the observable outcome, make the smallest coherent change,
prove the affected behavior, and report what was actually checked. Existing patterns are useful
evidence, not permanent architecture.

## Map

- `apps/daemon`: Node daemon, HTTP/WS API, filesystem, Git, terminals, persistence, sharing.
- `apps/web`: React client used in browsers and loaded by Electron.
- `apps/desktop`: thin Electron shell and local-daemon lifecycle.
- `apps/mobile`: Expo/React Native client of the daemon.
- `plugins/porcelain`: shipped MCP connection and companion/remote procedures.
- `packages/contracts`: shared wire contracts.
- `packages/client-runtime`, `packages/shared`, `packages/ui`: reusable client and UI code.

Read [docs/development.md](docs/development.md) when setting up, running, testing, or working in
parallel. Read [docs/architecture.md](docs/architecture.md) when a change crosses package or
runtime boundaries. Read [docs/remote-access.md](docs/remote-access.md) for daemon exposure,
pairing, or credentials. Read [docs/runtime-proof.md](docs/runtime-proof.md) for browser, Electron,
or mobile runtime validation. Read [docs/release.md](docs/release.md) only for release work.

## Development boundary

Use the development daemon for product work. The primary development checkout uses port `43118`,
`~/.porcelain-dev`, and playgrounds. Managed worktrees use ports `43200–43999` and their own
development homes/playgrounds. Production uses `~/.porcelain` and its configured listener; never
point an agent at it.

`PORCELAIN_DEV` protects the playground boundary and enables `/dev-auth`. Never put a token in
browser `localStorage`. Start only processes you can identify and stop the processes you started
by their tracked PID or managed worktree record.

## Working loop

1. Read the Task and inspect the owning code. State the user-visible outcome.
2. Make the smallest change that can produce that outcome. Keep unrelated cleanup separate.
3. Format and run the closest useful typecheck/test. Exercise the real path when the change is
   runtime-facing, visual, remote, Electron, or mobile.
4. Repeat until the behavior is demonstrated. Run broad verification only when the change or the
   request warrants it; CI owns clean-machine coverage.
5. Report the change, commands/evidence, and remaining uncertainty. Commit a coherent unit when
   the work is ready. Push only when asked.

Validation is proportional: pure logic needs a focused test; daemon procedures need a focused
procedure or integration check; UI needs a focused test and runtime proof when useful; a build or
release change needs the affected build or smoke path. Use runtime proof when building,
installing, delivering, or proving browser, Electron, or mobile behavior.

## Surface check

For UI or cross-package changes, consider the affected entry points and reverse states. Browser
and Electron share the web client. Local and remote daemons are separate environments. Mobile
uses the same daemon contracts but has native lifecycle and terminal behavior. Say which surfaces
you checked and which remain unproved instead of implying universal coverage.

## Delivery

Work on `main` for direct work, or use `pnpm worktree create <slug>` for an isolated branch. Keep
the worktree clean enough for the next person to understand. Do not push or publish without an
explicit request. Product future work lives in Porcelain Tasks; this repository documents current
behavior and operational facts only.

## Hard safety rules

- Development work uses playgrounds and development homes; production repositories and state are
  never test fixtures.
- A process you did not start and track is not yours to kill.
- A passing mock or a successful build is not evidence of runtime behavior; exercise the affected
  path before calling it done.

## Documentation discipline

Keep one source for each fact. Put current setup and the development loop in
`docs/development.md`, runtime ownership in `docs/architecture.md`, remote operations in
`docs/remote-access.md`, client validation in `docs/runtime-proof.md`, and release operations in
`docs/release.md`. Porcelain Tasks describe future work. Update a document when its owned fact
changes; do not add plans, policy matrices, or architecture rules to preserve a superseded direction.
