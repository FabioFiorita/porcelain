---
name: desktop-verify
description: Drive Porcelain Dev, the Mac app unpackaged from the checkout, through the desktop control CLI following the native feature map, run its Playwright Electron e2e tests, and check the installed app's lock. Use when changing apps/desktop, the desktop bridge contract or the Mac build, or a behaviour only the Electron shell has.
---

# Desktop verification

This skill covers what only the Electron shell does: the native folder picker, the Keychain-backed remote credentials, the window, the menus and the installed app's lock. The web inside the app is `web-verify`'s, including `start --desktop` for UI only the desktop shows. Everything here needs macOS; on Linux `start` and the e2e tests stop and say so.

`C=.agents/skills/desktop-verify/scripts/cli`, run from the repository root on the Mac. Run `$C` alone for every command. The CLI drives and records; it never asserts and never runs tests.

## 1. Start

```sh
$C start
```

It stages Porcelain Dev with a temporary profile and a sample repository, `desktop-smoke`, and prints the instance id, the evidence folder, the repository and the profile.

## 2. Find the feature

Read `.agents/skills/desktop-verify/features/README.md`, then the feature's map file.

## 3. Drive it

Run each line of the map's **Driving it** and compare the window with the end state it names. Web commands work as in `web-verify`; the native ones run in the main process:

```sh
$C menu "File/Open Project…"
$C dialog <repository>
$C window fullscreen on
$C window
```

The folder picker is held from `start`: a sheet the app opens never shows and waits for `dialog`. When the window is not where the map says, `snapshot` first.

## 4. Read the evidence and stop

```sh
$C evidence
$C stop
```

One numbered file per command, redacted, plus the app's output in `supervisor.log` and, after `stop`, `server.log`. Report the folder and what it shows.

## 5. Run the test file the entry names

```sh
pnpm --filter @porcelain/desktop exec playwright test spec/e2e/window.e2e.ts
```

A failed test keeps screenshots, the server log and renderer errors in `apps/desktop/test-results/e2e/`.

Sessions have no idle expiry. Stop your instance when finished. After stopping, `$C evidence --instance <id>` reads the retained evidence and `$C stop --instance <id>` repeats a confirmed stop without signaling processes. A failed stop exits nonzero and retains private runtime state; inspect its report before retrying.

## Gotchas

- `safeStorage` fails over SSH with "User interaction is not allowed". Run a test or instance that writes credentials in a Terminal window of the logged-in session and read its log:

  ```sh
  osascript -e 'tell application "Terminal" to do script "cd <checkout> && caffeinate -d -u pnpm --filter @porcelain/desktop exec playwright test spec/e2e/bridge.e2e.ts > /tmp/desktop-e2e.log 2>&1; echo exit $? >> /tmp/desktop-e2e.log"'
  tail -f /tmp/desktop-e2e.log
  ```

- macOS finishes a full screen transition only on an unlocked screen, so `window.e2e.ts`'s full screen test fails while the session is locked. Check with `ioreg -n Root -d1 -a | grep -A1 CGSSessionScreenIsLocked`. `folder-picker` and `menus` run fine over SSH.
- After you edit desktop, web, server or CLI code, commands refuse until you `stop` and `start` again. With two instances, every command needs `--instance <id>`. The session ends if its app quits.

## The installed app's lock

`pnpm desktop:build` and `pnpm desktop:install` are the owner's. After the owner installs a build that changes the lock (`features/app.installed-lock.md`), and only when the owner asks, check it:

```sh
$C installed-check
```

It needs no instance, runs over SSH, launches the installed app only with disposable profiles and debugging switches, and records what each launch did; the map says what to look for.
