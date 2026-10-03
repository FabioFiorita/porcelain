---
name: desktop-verify
description: Drive Porcelain Dev, the Mac app unpackaged from the checkout, through the desktop control CLI following the native feature map, run its Playwright Electron e2e tests in the logged-in session, and check the installed app's lock. Use when changing apps/desktop, the desktop bridge contract or the Mac build, or a behaviour only the Electron shell has.
---

# Desktop verification

The Mac app is Electron around the web and the server: the host process in `apps/desktop/src`, the web built in Vite's `desktop` mode and served at `porcelain://app`, the server in an Electron utility process. This skill covers what only the shell does: the native folder picker, the Keychain-backed remote credentials, the window, the menus and the installed app's lock. The web inside the app is `web-verify`'s, including `start --desktop` for UI only the desktop shows.

Never build, install or launch the owner's installed app, `/Applications/Porcelain.app`, or touch its profile to test a change: the owner keeps using Porcelain while agents work. `pnpm desktop:install` stays a command the owner runs or approves.

Everything here needs macOS. On Linux the CLI's `start` and `test:e2e` stop and say so; `pnpm check` runs anywhere.

## 1. Interactive development: `pnpm dev --desktop`

For the owner, not for proof. It runs the real app unpackaged from the checkout as Porcelain Dev: Electron from `node_modules` on `dist/desktop/development/`, the web from Vite's dev server, hot reloading through `porcelain://app`. Only an app given a Vite server (`--web-dev-server`) shows the Reload and Developer Tools menus. A change to `apps/desktop/src` takes effect at the next `pnpm dev --desktop`.

## 2. Verify: the control CLI

`.agents/skills/desktop-verify/scripts/cli` drives a disposable Porcelain Dev and records every command as a numbered evidence file. It never asserts and never runs tests: you read the evidence and decide. Run every command from the repository root, on the Mac.

### Start

```sh
.agents/skills/desktop-verify/scripts/cli start
```

`start` checks its tools and stops with what to install: macOS, and Electron in `node_modules` (`pnpm install --frozen-lockfile`). `doctor` runs the same checks and lists the live instances. Then it stages the app as Porcelain Dev in `dist/desktop/verify/`, with the web built in `desktop` mode and served by the app's own server as the installed app serves it, and launches it through Playwright Electron with a temporary profile (`--data-directory`) and a sample Git repository, `desktop-smoke`, as its project home. It prints the instance id, the evidence folder, the repository and the profile. It holds `caffeinate -d -u` while the instance lives, so the display stays awake: macOS never finishes a full screen transition while it sleeps.

- **Several instances.** Each `start` makes a new one, registered for this checkout only; with more than one live, every command needs `--instance <id>`.
- **Stale code.** A command refuses once the desktop, web, server or CLI code changed after `start`; run `start` again.
- **Idle.** An instance with no command for 30 minutes stops itself; every command counts, failed or not. So does one whose app quits. The evidence stays.
- **Keychain.** Credentials go through `safeStorage`, which needs the Keychain of the logged-in session (section 4); start the instance there when the feature writes credentials.

### Find the feature

Open `features/README.md` and the map file of the native feature: its frontmatter names the selectors its steps use and the tests that guard it; **Driving it** has the exact lines and the end state to look for.

### Drive it

| Command                                                                        | What it does                                                                                              |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `open <route>`                                                                 | opens `porcelain://app<route>` in the window                                                              |
| `click`, `fill`, `press`                                                       | as in `web-verify`: `--role <role> --name <name>`, `--testid`, `--text`, `--button right`; a key or chord |
| `snapshot`, `screenshot`, `console`, `network`, `trace start\|stop`            | record the window's accessibility tree, pixels, console, requests or a Chrome trace                       |
| `menu`                                                                         | records the application menu tree with labels, ids, roles and accelerators                                |
| `menu <path>`                                                                  | clicks a menu item by its labels, such as `"File/Open Project…"`                                          |
| `window`                                                                       | records every window's bounds, normal bounds, maximized, full screen, focus and URL                       |
| `window resize <w> <h>`, `maximize`, `fullscreen on\|off`, `close`, `activate` | changes the window first; `activate` is the Dock reopening it                                             |
| `dialog <folder>`, `dialog --cancel`                                           | answers the native folder picker that is waiting, or the next one                                         |
| `dialog`                                                                       | records every request the app made of the picker: owner window, title, button, default path, properties   |

The web commands are the web CLI's own, attached to the app's window over its DevTools endpoint. The native ones run in the main process. The picker is held from `start`: a sheet the app opens never shows, it waits for `dialog`.

When the window is not where the map says, take a `snapshot` first. A map line that no longer matches the app is drift; correct the map.

### Read the evidence and stop

```sh
.agents/skills/desktop-verify/scripts/cli evidence
.agents/skills/desktop-verify/scripts/cli stop
```

The folder holds `000-start.txt`, one numbered file per command, the supervisor log with the app's output, and after `stop` the server's `server.log`. Credentials, pairing codes and links, share signatures, bearers and the control token are written as `[redacted]` in every text file; `snapshot` prints the window as it is so a next step can use what it shows. `stop` ends only the instance the CLI started: it signals the PID in its instance file only while that process's command line is the instance's supervisor, quits the app, removes its profile and repository, then sends SIGKILL to whatever is left of its process group and browser session after a timeout; a recorded PID that now belongs to another process is reported and never signalled. The evidence stays. The report names the evidence folder and what it shows.

## 3. Test: Playwright Electron e2e

```sh
pnpm --filter @porcelain/desktop test:e2e
pnpm --filter @porcelain/desktop exec playwright test spec/e2e/window.e2e.ts
```

The tests live in `apps/desktop/spec/e2e/`, one file per native feature, each named in its map's `tests`. The global setup refuses any host but macOS, holds `caffeinate -d -u` for the run, and stages Porcelain Dev in `dist/desktop/e2e/` the same way the CLI does. Every test launches the app with a fresh temporary profile and sample repository through the `desktop` fixture:

- `desktop.launch(profile?)` launches the staged app and returns a `DesktopApp`; every app a test launched is quit when it ends, and one that will not quit is killed.
- `app.window()` waits for the app page; `app.nextWindow()` for the window the app opens next; `app.errors` collects renderer errors and console errors.
- `app.holdPicker()`, `app.pickerRequest()`, `app.answerPicker(selection)` supply the native folder picker at Electron's boundary.
- `app.clickMenu(id)`, `app.menuRoles()`, `app.server()`, `app.askOwner(method, path)` reach the menu and the server's owner socket.

Read renderer state with typed functions against `DesktopBridge` (lint refuses source text passed to `evaluate`), and assert what the user or the profile shows. A failed test keeps each window's screenshot, the server log and the renderer errors in `apps/desktop/test-results/e2e/`; the HTML report is in `apps/desktop/test-results/e2e-report/`.

## 4. Run in the logged-in session

`safeStorage` fails over SSH with “User interaction is not allowed”, so run the tests, and any instance that writes credentials, in a Terminal window of the logged-in session and read the log afterwards:

```sh
osascript -e 'tell application "Terminal" to do script "cd ~/Code/<worktree> && caffeinate -d -u pnpm --filter @porcelain/desktop test:e2e > /tmp/desktop-e2e.log 2>&1; echo exit $? >> /tmp/desktop-e2e.log"'
tail -f /tmp/desktop-e2e.log
```

`caffeinate -u` declares user activity and wakes a sleeping display. macOS finishes a full screen transition only on an awake, unlocked screen: while the session is locked the full screen test of `window.e2e.ts` fails with the window never entering or leaving full screen, so the owner unlocks the Mac for a full run. Check with `ioreg -n Root -d1 -a | grep -A1 CGSSessionScreenIsLocked`. The tests that never touch credentials or full screen (`folder-picker`, `menus`) also run over SSH.

## 5. The installed app

`pnpm desktop:build` builds `dist/desktop/Porcelain-darwin-<arch>/Porcelain.app`; `pnpm desktop:install` builds, verifies its signature and replaces `/Applications/Porcelain.app`, keeping the previous app in `~/Library/Caches/Porcelain/build-backups.noindex/`. Both are the owner's. Signing reads the identity in `PORCELAIN_MAC_SIGNING_IDENTITY` from the login Keychain (ad hoc when unset), so install in the logged-in session. A stable identity keeps the Keychain from asking again after each build.

The installed app is locked against debugging (`features/app.installed-lock.md`). After the owner installs a build that changes the lock, and with the owner's go-ahead:

```sh
.agents/skills/desktop-verify/scripts/cli installed-check
```

It needs no instance and runs over SSH. It reads the fuse wire, launches the installed app with `--inspect=0`, `--remote-debugging-port=0` and `ELECTRON_RUN_AS_NODE=1`, each with a disposable profile, and once with `NODE_OPTIONS=--inspect=0 --require <payload>`, and records for each launch the exit, the output, whether it created its profile, opened a debugging endpoint or ran the payload, plus the running copies and the owner's profile before and after. It asserts nothing; the map says what to look for.

## Where each app keeps its data and logs

| App                                  | Profile                                                                                                                                                                | Logs                                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Installed Porcelain                  | `~/Library/Application Support/Porcelain/`: `credentials.enc` (remote computers, encrypted through the Keychain), `window.json`, `server/` (database and owner socket) | `~/Library/Logs/Porcelain/server.log`, moved aside to `server.log.1` at `LIMITS.desktop.serverLogBytes`    |
| Porcelain Dev (`pnpm dev --desktop`) | `~/Library/Application Support/Porcelain Dev/`, with its own single-instance lock and Keychain entry                                                                   | `~/Library/Logs/Porcelain Dev/`                                                                            |
| CLI instance                         | a temporary profile `start` prints, removed by `stop`                                                                                                                  | `<profile>/logs/server.log`, copied to the evidence folder by `stop`; the app's output in `supervisor.log` |
| e2e test                             | a temporary profile per test, removed when it ends                                                                                                                     | `<profile>/logs/server.log`, attached to a failed test                                                     |

`--data-directory <folder>` moves a profile and its logs to `<folder>/logs`; `--project-home <folder>` sets where Open Project starts. Development servers keep their own data.
