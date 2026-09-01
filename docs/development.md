# Development

This is the canonical development loop. Releases continue in [release.md](release.md), and remote
operations in [remote-access.md](remote-access.md). Both reuse this setup and isolation model.

## First run

From the primary checkout:

```sh
pnpm install
pnpm build
pnpm dev:env       # read-only: show the active profile and every path/port
pnpm dev:daemon    # browser/mobile daemon, when a separate client needs it
```

The daemon launcher uses `~/.porcelain-dev` and a disposable playground; it is the only
environment for ordinary agent product work. `http://127.0.0.1:43118/` serves the browser
client from the built renderer dist — correct, but rebuilt only by `pnpm build:web`.

For a quick primary-checkout change, `pnpm dev` is the one-command Electron path. The root
launcher applies the same profile as `pnpm dev:daemon` before starting Electron, and Electron
starts its own daemon on that profile's port. Use `pnpm dev` for Electron or `pnpm dev:daemon`
for a separate browser/mobile client; do not run both for the same profile at once.

## Editing the web client

Run `pnpm dev:web` beside the daemon and open `http://127.0.0.1:53118/` (the daemon port plus
10000, so a managed worktree gets its own). That is the same `apps/web` source over Vite with
hot module replacement, proxying `/trpc`, `/session`, `/dev-auth`, `/pair`, `/canvas`, and
file previews to the daemon of that checkout, so an edit is on screen in well under a second with
the app state intact. `pnpm dev` runs the Electron client with its own HMR renderer and the same
profile-scoped daemon.

Rebuilds are for the other layers, not for web edits:

| Changed | Cost |
| --- | --- |
| `apps/web` with `pnpm dev:web` | hot, no command |
| `apps/web` for the daemon-served client | `pnpm build:web`, then reload the page |
| `apps/daemon` | `pnpm build:daemon`, then restart `pnpm dev:daemon` |
| Electron shell (`apps/desktop/src/main`) | `pnpm build`, then restart `pnpm dev` |

`pnpm build` also runs the full typecheck, which is most of its time; reach for it before
delivery, not between edits.

The development environment is intentionally distinct from the published daemon:

| Environment | Port | Home | Repositories |
| --- | ---: | --- | --- |
| Production | configured listener | `~/.porcelain` | real checkouts |
| Primary development | 43118 | `~/.porcelain-dev` | playgrounds |
| Managed worktree | 43200–43999 | `~/.porcelain-dev-worktrees/<slug>` | per-worktree playground |

`PORCELAIN_DEV` enables the playground boundary and development authentication. Use
`pnpm dev:pair` when another device needs a development pairing link. Never copy production
credentials into a browser or local storage.

Each profile also owns a local MCP channel under its `PORCELAIN_HOME`. The shipped plugin connects
to that channel directly; MCP is not part of the daemon's TCP listener and is not forwarded by the
web development server.

## Choose primary or a managed worktree

Use the primary checkout when one quick fix is the only active change:

```sh
pnpm dev:env
pnpm dev
```

The root `pnpm dev` launcher detects the primary checkout and passes its `PORCELAIN_HOME`,
`PORCELAIN_USER_DATA`, daemon port, playground, admin-token file, and `PORCELAIN_DEV` flag to
Electron and its daemon child. Electron's user-data directory is also its single-instance-lock
scope, so this profile cannot hijack the installed app.

When a second independent change appears, create or adopt a managed worktree and use the same
commands from inside it:

```sh
pnpm worktree create companion-review
cd /path/to/companion-review
pnpm dev:env
pnpm dev
```

Managed and adopted worktrees are identified by `.porcelain-worktree.json`. They receive a
distinct daemon port, channels, token, playground, Electron user-data directory, and lock. The
same profile is used by `pnpm dev:daemon` and `pnpm dev:web`, so each checkout can run its own
client stack without sharing state. `pnpm worktree list` shows the recorded allocations.

The Codex project environment automatically gives its harness checkout an isolated profile before
installing dependencies. It preserves detached HEAD; profile identity, ports, paths, and playground
do not require a Git branch. Create a branch only when implementation or PR delivery calls for one.
For another external harness, run `pnpm dev:env` before starting anything. When it reports `primary
checkout`, adopt that checkout from the primary repository with `pnpm worktree adopt <path> <slug>`.
External adoption keeps the checkout in place while adding its branch, profile, port, and playground.

`pnpm dev:mobile` gives each development profile its own Metro port and temporary state. The
primary checkout uses port 8081; managed worktrees derive a port from their daemon allocation.
Physical devices, AVDs, and iOS simulator UDIDs are still shared machine resources: select them
explicitly, and never stop one that the current session did not start.

## The working loop

1. Read the request and inspect the owning code. Describe the observable outcome.
2. Make the smallest coherent change. Keep unrelated cleanup separate.
3. Format changed files and run the closest useful typecheck or test.
4. Exercise the affected runtime path when the change is user-facing, remote, Electron, or mobile.
5. Repeat until the behavior is demonstrated. Report commands, evidence, and uncertainty.

Use `pnpm verify` for a deliberate broad check or before delivery when it is available and useful;
do not make it the inner loop for every edit. CI is the clean-machine check. The proof should match
the risk: a focused unit test for logic, a daemon procedure check for server behavior, a browser or
Electron interaction for client behavior, and native runtime evidence for mobile behavior.

The package build, test, and typecheck entry points run through Turborepo. CI and release jobs
configure Vercel's Turborepo OIDC remote-cache action with the `TURBO_TEAM` repository variable
before invoking those commands; `.turbo/` stays ignored locally. Unchanged package tasks can
therefore be skipped while the existing root commands keep their names. Turbo does not cache
runtime proof, macOS signing/notarization, artifact publication, or npm registry propagation.

## Useful commands

The exact scripts are the source of truth (`pnpm run` lists the checkout's commands). Common entry
points are:

```sh
pnpm dev:daemon       # isolated daemon, port 43118 or the worktree allocation
pnpm dev:web          # browser client with HMR, daemon port + 10000
pnpm dev              # Electron client + its profile-scoped daemon
pnpm dev:env          # read-only active profile, paths, ports, and start commands
pnpm build:web        # rebuild the dist the daemon itself serves
pnpm build:daemon     # rebuild the daemon bundle (restart the launcher after)
pnpm format           # write formatting
pnpm lint             # source checks configured by the checkout
pnpm test              # desktop/Vitest suite; pass a focused target when supported
pnpm build            # product build/typechecks
pnpm turbo run build --filter=@porcelain/desktop  # inspect the production build graph
```

Browser and Electron acceptance have explicit scopes. `pnpm test:e2e:smoke` is the small browser
lane used in CI; `pnpm test:e2e` is the broader browser acceptance lane and is not part of
`pnpm verify`. Run `pnpm test:e2e:pairing` for the real unpaired/link exchange.
Each has a `:prebuilt` form for use after `pnpm build` or `pnpm verify`.

Use the package-local command when the affected package has a narrower check. A successful mock
assertion or build is not runtime proof.

## Parallel worktrees

Use a managed worktree when separate changes must proceed at the same time:

```sh
pnpm worktree create companion-review
pnpm worktree create mcp-channel
pnpm worktree list
```

Create from the primary checkout, usually based on `main`. Each managed worktree gets a
`work/<slug>` branch, an allocated development port, isolated channels/user data, and a disposable
playground. Start its daemon from inside that worktree so `scripts/dev-env.mjs` selects the right
profile. Do not point two worktrees at the same home or manually reuse a daemon port.

For handoff, record the branch, task, running daemon PID, port, and validation evidence. Keep
commits coherent so a later merge can identify the product unit. Use `pnpm worktree pr <slug>` only
when publication is requested. After a branch is merged and clean, `pnpm worktree remove <slug>`
stops its recorded daemon and removes its disposable worktree state; review the command output
before confirming removal.

## Runtime proof

Browser and Electron load the same web client, but they have different launch and preload paths.
Use the browser for renderer-only work and Electron when preload, IPC, windows, menus, updates, or
the local daemon lifecycle matter. Mobile adds native lifecycle, installation, and terminal
rendering. Drive the selected client with the strongest native browser, computer, or device tooling
available in the current harness; do not add a repository wrapper for a capability the harness
already provides. Record what was observed and name any affected client left unproved.

## Cleanup

Stop daemons and test servers started for the task. Remove generated evidence directories such as
`test-results/`, `playwright-report/`, and `apps/desktop/e2e/.artifacts/` when they are no longer
needed. Never use a broad process kill that could terminate another worktree or the production
daemon.
