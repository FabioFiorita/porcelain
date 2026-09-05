# Development

Use [package.json](../package.json) and package-local scripts for available commands, and
[the code map](architecture.md) to find implementation owners. Repository safety and proof
expectations live in [AGENTS.md](../AGENTS.md).

## Development terms

- **Promotion:** Making selected private Porcelain data repository-visible. It does not itself
  stage or commit that data.
- **Playground:** Disposable repository data used to exercise development behavior without
  touching real projects.

## Host setup

Install the Node and pnpm versions declared in [package.json](../package.json), plus Git.
macOS native builds need the Xcode command-line tools.

Windows needs Visual Studio 2022 Build Tools with **Desktop development with C++**, a current
Windows SDK, and the **MSVC v143 x64/x86 Spectre-mitigated libs** matching the installed toolset.
The dependency install rebuilds `node-pty`. Symlink-containment tests need Windows Developer Mode
or an elevated shell; ordinary use does not require elevation.

Use PowerShell for a Windows checkout. A WSL checkout belongs to a Linux daemon inside that
distribution; do not register a `\\wsl.localhost` path with the Windows daemon.

```sh
pnpm install
pnpm build
pnpm dev:env
```

`dev:env` is read-only. Use its output for this checkout's profile, paths, ports, playground, and
launch commands instead of copying values from another session. The profile implementation is
[scripts/dev-env.mjs](../scripts/dev-env.mjs).

## Choose a client

| Client | Start |
| --- | --- |
| Electron with its daemon | `pnpm dev` |
| Browser with hot reload | `pnpm dev:daemon`, then `pnpm dev:web` in another terminal |
| Daemon-served browser | `pnpm dev:daemon`, then open its printed browser URL |
| Mobile Metro | `pnpm dev:daemon`, then `pnpm dev:mobile` in another terminal |

Use one daemon owner per profile. Do not combine `pnpm dev` with `pnpm dev:daemon`.
The development daemon automatically connects local browsers by default. For mobile or a browser
that needs pairing, use `pnpm dev:pair` and open its one-time link on the client.
Use `pnpm dev:daemon --no-auto-auth` when testing the browser pairing flow.

The development daemon listens on loopback by default. Use `pnpm dev:daemon --lan` for another
machine or a physical device on the local network, or `--tailnet` for Tailscale access.
For Linux-to-Mac development, run Metro on the Linux checkout and use XcodeBuildMCP on the Mac
for the simulator. Select the reachable Metro host and port for that connection; the repository
does not assume an SSH alias or start a separate simulator-preview service.

Web edits use hot reload in `dev:web`. Rebuild with `pnpm build:web` for the daemon-served client.
For daemon edits, run `pnpm build:daemon` and restart the daemon; desktop main/preload edits need
`pnpm build` and an Electron restart.

For development MCP tools, set the plugin connector's `PORCELAIN_HOME` to the channels directory
printed by `dev:env`. Opening a browser URL does not select the plugin's profile. The
[connector](../plugins/porcelain/bin/porcelain-mcp.mjs) owns channel resolution; the
[companion skill](../plugins/porcelain/skills/companion/SKILL.md) covers collaboration operations.
If tools are unavailable, continue independent work and report any requested collaboration left
unrecorded.

## Mobile devices

The Codex Android phone/tablet actions open `Phone` and `Tablet` AVDs using the checkout's
Metro and daemon ports. Start **Dev daemon** and **Mobile Metro** first. The development app
must already be installed. For different AVD names, set `PORCELAIN_ANDROID_PHONE_AVD` and
`PORCELAIN_ANDROID_TABLET_AVD` in the host environment. The same launch commands work on
Windows, macOS, and Linux: `pnpm dev:mobile:android phone` or `pnpm dev:mobile:android tablet`.
Close the emulator window when finished; a reused emulator is left running.

Devices and simulators are machine-global even when development profiles are isolated. Select the
intended device and stop only one this task started. The
[mobile launcher](../scripts/mobile-dev.mjs) owns profile setup.

On a Mac, choose an iOS simulator explicitly:

```sh
PORCELAIN_IOS_SIMULATOR='iPhone 17 Pro' pnpm dev:mobile:ios
```

Use `PORCELAIN_IOS_SIMULATOR` rather than overriding the launcher's `--device` or `--port`.
Stop the task's Metro process when finished.

To build an Android development APK with an installed JDK and Android SDK, select a connected
device explicitly:

```sh
pnpm dev:mobile:android build --device <serial>
```

This uses the checkout's Metro port and the device's architecture. It prints the APK path without
installing it or starting Metro. Install with `adb -s <serial> install -r <apk-path>`.

Use Android SDK tools directly for device inspection and interaction. Select the device explicitly
with `adb -s <serial>`; `adb devices -l` lists available targets. Logs use `logcat`, native UI
inspection uses `shell uiautomator dump`, and screenshots use `exec-out screencap -p`.
Keep screenshot output binary. Runtime validation guidance lives in the runtime skill's
[Android reference](../.agents/skills/runtime-evidence/references/android.md).

## Isolated checkouts

```sh
git worktree add ../porcelain-feature -b feature
cd ../porcelain-feature
pnpm worktree setup
pnpm install --frozen-lockfile
pnpm dev:env
```

Use `pnpm worktree list` for allocations. The [Codex environment](../.codex/environments/environment.toml)
sets up task profiles automatically. For other Git worktrees, run `pnpm worktree setup` before
launching. The [profile command](../scripts/worktree.mjs) allocates ports, development data,
and a playground without changing Git state.

Run `pnpm worktree cleanup` from the assigned checkout before removing it with Git or its harness.
Cleanup removes only Porcelain development resources and profile metadata; it preserves files,
branches, and commits. Both setup and cleanup accept an explicit checkout path.

## Checks

Use `pnpm run` and the owning package's scripts to choose checks. The
[desktop scripts](../apps/desktop/package.json) expose focused Vitest and browser/Electron lanes;
[CI](../.github/workflows/ci.yml) shows the automated gate. `pnpm verify` runs static checks,
unit/integration tests, the build, script tests, and browser E2E. Install Chromium once with
`pnpm --dir apps/desktop exec playwright install chromium` before the first browser test run.
Native Electron and mobile validation remain separate, platform-specific checks.
Use `:prebuilt` acceptance commands only after building the affected output.

Tests and build results establish only what they exercise. Follow [AGENTS.md](../AGENTS.md) for
runtime evidence and cleanup. Packaging and publication have a separate [release guide](release.md).
