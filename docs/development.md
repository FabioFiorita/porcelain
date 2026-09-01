# Development

This is the supported local development environment. Release work continues in
[release.md](release.md); remote-host operation is documented in
[remote-access.md](remote-access.md).

## Setup and isolation

```sh
pnpm install
pnpm build
pnpm dev:env
```

`pnpm dev:env` is read-only. Before launching Porcelain, use its output to confirm the active
profile, port, home, user-data directory, playground, and start commands.

| Environment | Port | Home | Repository data |
| --- | ---: | --- | --- |
| Production | configured listener | `~/.porcelain` | real checkouts |
| Primary development | 43118 | `~/.porcelain-dev` | disposable playgrounds |
| Managed Worktree | 43200–43999 | `~/.porcelain-dev-worktrees/<slug>` | per-Worktree playground |

Development launchers set `PORCELAIN_DEV`, apply the matching profile, and keep authentication,
channels, Electron user data, Metro state, and repository fixtures away from production. Never use
production state or credentials as a test fixture.

Choose one client path for a profile:

```sh
pnpm dev                 # Electron and its profile-scoped daemon
pnpm dev:daemon          # daemon for a separate browser or mobile client
pnpm dev:web             # Vite/HMR browser client beside dev:daemon
pnpm dev:mobile          # profile-scoped Metro beside dev:daemon
```

Do not run `pnpm dev` and `pnpm dev:daemon` for the same profile simultaneously. The daemon-served
browser uses the port printed by `pnpm dev:env`; the HMR browser uses that port plus 10000. MCP uses
a profile-scoped local OS channel under `PORCELAIN_HOME`, not the daemon's TCP listener.

## Worktrees

Use the primary checkout for one direct change. Use a managed Worktree when independent work needs
isolation:

```sh
pnpm worktree create <slug>
cd <printed-path>
pnpm dev:env
```

Managed Worktrees carry `.porcelain-worktree.json` and receive distinct ports, homes, channels,
playgrounds, Electron data, and Metro state. `pnpm worktree list` shows current allocations.

The checked-in Codex environment bootstraps a detached task checkout before installing dependencies.
It must create `.porcelain-worktree.json` without attaching a branch. If a Codex task instead reports
`primary checkout`, stop before launching Porcelain and recreate the task with the checked-in
environment selected. External harness Worktrees can be adopted from the primary checkout with
`pnpm worktree adopt <path> <slug>`.

Simulator ids, physical devices, and Android virtual devices remain machine-global resources even
when Metro is isolated. Select them explicitly and stop only a device or process this task started.

## Build and validation

The root scripts and package-local scripts are the command authority; `pnpm run` lists them. Common
entry points are:

```sh
pnpm format
pnpm check
pnpm test
pnpm build
pnpm verify
pnpm build:web
pnpm build:daemon
```

Web edits through `pnpm dev:web` are hot. Rebuild the web output before testing the daemon-served
client. Daemon changes require `pnpm build:daemon` and a daemon restart. Electron main/preload work
requires a product build and Electron restart.

Use the smallest proof that demonstrates the behavior. Browser and Electron share the web client,
but Electron separately owns preload, IPC, windows, menus, updates, and local-daemon lifecycle.
Mobile adds native lifecycle, installation, and terminal rendering. Use the strongest native
browser, computer, or device capability available, and name any affected client left unproved.

Browser acceptance has a small CI smoke lane and a broader lane:

```sh
pnpm test:e2e:smoke
pnpm test:e2e
pnpm test:e2e:pairing
```

Each has a `:prebuilt` form after `pnpm build` or `pnpm verify`. Package-local commands are often the
better inner loop. A mock or successful build does not prove a user-facing runtime path.

Turborepo runs build, test, and typecheck tasks and may reuse remote-cache results in CI. Runtime
proof, native packaging, signing, publication, and registry propagation are never established by a
cache hit.

## Handoff and cleanup

Record the branch, checkout, validation, runtime evidence, and any task-owned process still running.
Stop daemons and test servers started for the task. Remove generated evidence such as
`test-results/`, `playwright-report/`, and `apps/desktop/e2e/.artifacts/` when it is no longer needed.
Never kill processes by broad name pattern.

After a managed Worktree's branch is integrated and clean, remove it from the primary checkout with
`pnpm worktree remove <slug>`. Review the command's targets before confirming deletion.
