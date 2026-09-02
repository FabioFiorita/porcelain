# Development

This is the supported local development environment. Release work continues in
[release.md](release.md); remote-host operation is documented in
[remote-access.md](remote-access.md).

## Host prerequisites

All hosts need Node 22+, pnpm, and Git. macOS needs the Xcode command-line tools.

Windows development additionally needs Visual Studio 2022 Build Tools with the
**Desktop development with C++** workload and a current Windows SDK. `pnpm install` invokes
Electron's native dependency rebuild; without that toolchain, `node-pty` fails before Porcelain
can start. In **Individual components**, also select the current **MSVC v143 - VS 2022 C++
x64/x86 Spectre-mitigated libs** matching the installed toolset. Enable Windows Developer Mode
when running the symlink-containment tests, or run those tests from an elevated shell. Ordinary
Porcelain use does not require elevation.

Run Porcelain from PowerShell in the Windows checkout. A WSL checkout is a separate Linux
Environment and must be owned by a daemon running inside that distribution; do not register a
`\\wsl.localhost` path with the Windows daemon.

The Windows app discovers installed WSL distributions and reports whether each one can host a
daemon. The distribution itself needs WSL 2, Node 22+, `npm`/`npx`, Git, and a C toolchain for the
first native dependency build; Windows-installed tools do not satisfy those checks. Docker
Desktop's internal distributions are intentionally excluded. Settings → Environments → **Set up
WSL Environment** installs the daemon version matching the desktop app inside that distribution,
starts it on a distribution-specific loopback port, creates a normal revocable client credential,
names it **WSL**, and opens its project browser without replacing or reloading the Windows renderer.
Configured WSL Environments restart with the Electron app.

Production WSL state remains in the Linux user's normal Porcelain directories. Development and
e2e launches use separate Linux profiles, just as the Windows-local daemon does. The Electron
process owns only the WSL daemon processes it launched and stops those exact children on quit.

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

For an iPhone simulator, use the iOS launcher rather than reopening a development client that
remembers a previous LAN server. It requires the target to be explicit and starts Expo with this
Worktree's Metro port and the simulator-safe loopback address:

```sh
PORCELAIN_IOS_SIMULATOR='iPhone 17 Pro' pnpm dev:mobile:ios
```

The launcher owns `--device` and `--port`; choose another simulator through
`PORCELAIN_IOS_SIMULATOR`, not a CLI override. It builds or reinstalls when needed, then launches
the non-shipping `Porcelain Dev` development client bundle. The profile-scoped Metro process it
starts remains the task's responsibility to stop.

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
