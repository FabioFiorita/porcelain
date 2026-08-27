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
- `plugins/porcelain`: shipped MCP connection and companion/remote procedures. These ship
  installed, where this checkout does not exist — keep them self-contained and link a public URL
  when they must cite `docs/`.
- `packages/contracts`: shared wire contracts.
- `packages/client-runtime`, `packages/shared`, `packages/ui`: reusable client and UI code.

Read [docs/development.md](docs/development.md) when setting up, running, testing, or working in
parallel. Read [docs/architecture.md](docs/architecture.md) when a change crosses package or
runtime boundaries. Read [docs/remote-access.md](docs/remote-access.md) for daemon exposure,
pairing, or credentials. Read [docs/runtime-proof.md](docs/runtime-proof.md) to pick the client
surface a change must be observed in; each surface's driving loop is its own `prove-*` skill.
Read [docs/release.md](docs/release.md) only for release work.

## Development boundary

Use the development daemon for product work — the development doc routed above owns its ports,
homes, and playgrounds. Production is `~/.porcelain` and its configured listener; never point an
agent at it.

`PORCELAIN_DEV` protects the playground boundary and enables `/dev-auth`. Authenticate a browser
through `/dev-auth` or the pairing URL `pnpm dev:daemon` prints, and keep tokens out of browser
`localStorage`. Start only processes you can identify and stop the processes you started by their
tracked PID or managed worktree record.

## Working loop

1. Read the request and inspect the owning code. State the user-visible outcome.
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
explicit request. This repository documents current behavior and operational facts only.

Before starting a development process in a linked worktree, run `pnpm dev:env`. If it reports the
primary profile because an external harness created the worktree without `.porcelain-worktree.json`,
adopt it from the primary checkout with `pnpm worktree adopt <path> <slug>` so its ports and state
cannot collide with another checkout.

## Porcelain profile

Pinned and hidden paths are manual file-tree choices: agents preserve them exactly and never add,
remove, or recommend them. Story layer order belongs to each Review Canvas and is supplied with
that Review's `templateData.layers`; it never persists on the Worktree or carries into the next
Review. The navigation profile and Review shape live in the
[profile reference](plugins/porcelain/skills/companion/references/profile.md).

## Hard safety rules

- Development work uses playgrounds and development homes; production repositories and state are
  never test fixtures.
- A process you did not start and track is not yours to kill.
- A passing mock or a successful build is not evidence of runtime behavior; exercise the affected
  path before calling it done.

## Documentation discipline

Keep one source for each fact. The routing above says which document owns which subject, and it
says it once — a second route is a second owner. Update a
document when its owned fact changes; do not add plans, policy matrices, or architecture rules to
preserve a superseded direction. `pnpm lint:docs` holds both halves: one route per document, and
shipped skills that never reach into this checkout.
