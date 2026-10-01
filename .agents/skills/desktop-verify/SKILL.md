---
name: desktop-verify
description: Run the Mac app unpackaged from the checkout, prove it with Playwright against a development build, build and install the locked app, and check the installed app's lock. Use when changing apps/desktop, the desktop bridge contract, the Mac build, or web behaviour only the desktop shell shows.
---

# Desktop verification

The Mac app is Electron around the web and the server. Its host process lives in `apps/desktop/src`; its renderer is the web in Vite's `desktop` mode, served at `porcelain://app`; its server runs in an Electron utility process.

Development and proof never use the owner's installed app, `/Applications/Porcelain.app`, or its profile: the owner keeps using Porcelain while agents work. `pnpm desktop:install` replaces the installed app and stays a command the owner runs or approves.

## On any host

`pnpm check` typechecks the desktop app and runs the specs beside it in `apps/desktop/src`. A guard of the host process (who may call the bridge, what the protocol forwards, which links leave the app, which launches the installed app refuses) is a pure function in `apps/desktop/src/rules/` with a spec that fails when the guard is deleted.

A journey through UI only the desktop shell shows runs in Chromium with `shell: 'desktop'` (see `web-verify`); it gets the desktop web mode but no bridge, so it cannot prove the bridge, the protocol or the native menus. `pnpm devtools start --desktop` shows the web in Chrome as the app does, without the bridge. The HTTP net and the journeys run on Linux and macOS alike; see `server-verify` and `web-verify`.

## The development app

`pnpm dev --desktop` runs the real app unpackaged from the checkout: Electron from `node_modules` on `dist/desktop/development/`, which holds the bundled host, preload and server and the native modules rebuilt for Electron (rebuilt only when Electron or a native dependency changes), with the web from Vite's dev server in `desktop` mode, hot reloading through `porcelain://app`. It runs as Porcelain Dev, with its own profile in `~/Library/Application Support/Porcelain Dev/` (the server's data in its `server/`), its logs in `~/Library/Logs/Porcelain Dev/`, its own single-instance lock and its own Keychain entry, so it runs beside the installed app and never reads or writes its profile. A change to `apps/desktop/src` takes effect at the next `pnpm dev --desktop`. Only an unpackaged app given a Vite server (`--web-dev-server`) shows the Reload and Developer Tools menus and admits Vite's inline script; the installed app ignores the switch.

## The proof

The proof runs on macOS, arm64 or x64, with the Node version in `.node-version`, pnpm 12.3.4, Git and the Xcode Command Line Tools.

```sh
pnpm install --frozen-lockfile
pnpm verify:desktop
pnpm verify:desktop project
pnpm verify:desktop bridge-capabilities review-summaries
```

`pnpm verify:desktop` stages the app as Porcelain Proof in `dist/desktop/proof/`, with the web built in `desktop` mode and served by the app's own server as the installed app serves it, and runs every development feature against it: Electron from `node_modules`, a fresh temporary profile and Git repository per feature, driven with Playwright's Electron support. Named features run only those. It never builds the Mac app, installs it or touches `/Applications`. Each feature prints `PASS <feature>` and its evidence folder, `dist/desktop/evidence/<time>-<feature>/`: `result.json` with the promise and what was proven, screenshots, and `failure.txt` with the stack when it fails. The run stops at the first failure.

The features and their promises are in `scripts/feature-map.ts` beside the runner. A changed desktop behaviour changes its feature's promise and its checks in the same commit. Supply native dialogs at Electron's boundary from `app.evaluate`, read renderer state with typed functions against `DesktopBridge` from `@porcelain/contracts/desktop` (lint refuses source text passed to `evaluate`), and fail with a sentence that names the broken promise.

The app keeps remote-computer credentials through Electron's `safeStorage`, which needs the Keychain of the logged-in session. Over SSH it fails with "User interaction is not allowed", so run the proof, or at least `bridge-capabilities` and `review-summaries`, in a Terminal window of the logged-in session and read its log afterwards:

```sh
osascript -e 'tell application "Terminal" to do script "cd ~/Code/<worktree> && pnpm verify:desktop > /tmp/desktop-proof.log 2>&1; echo $? >> /tmp/desktop-proof.log"'
```

The display must be awake: macOS never finishes a fullscreen transition while it sleeps, and `project` then waits forever. `caffeinate -u -t 2` wakes it.

After a desktop change, run `pnpm check` where you are, then on a Mac run each affected feature once.

## The installed app

`pnpm desktop:build` builds `dist/desktop/Porcelain-darwin-<arch>/Porcelain.app` only. `pnpm desktop:install` builds it, verifies its signature and replaces `/Applications/Porcelain.app`, keeping the previous app in `~/Library/Caches/Porcelain/build-backups.noindex/`; a running copy keeps running until it is reopened. The build packages the web, bundles the host, its preload and the server with esbuild, rebuilds `better-sqlite3` for the Electron version pinned in `apps/desktop/package.json`, keeps native modules and the macOS trash executable outside the ASAR archive and signs ad hoc: there is no certificate, notarization, updater or distribution, and the app needs no separate Node or development server. Packaging itself is not part of the proof.

The installed app is locked against debugging, because anyone running as the owner could otherwise start it under a debugger and read the credentials it keeps in `safeStorage`. The build flips its Electron fuses: no run as Node, no `NODE_OPTIONS`, no Node inspect arguments, embedded ASAR integrity validation, the app loaded only from its ASAR, encrypted cookies and no extra `file://` privileges. Chromium's remote debugging is no fuse, so the packaged host refuses to start, before it takes the single-instance lock, when launched with a debugging switch or with `ELECTRON_RUN_AS_NODE` or `NODE_OPTIONS` set (`rules/launch-refusal.ts`). Playwright cannot drive it for the same reason.

Electron removes `NODE_OPTIONS` before any app code runs once its fuse is off, so the installed app cannot see it and starts as usual without it; the refusal of `NODE_OPTIONS` in the rule only guards a build that lost the fuse.

`pnpm verify:desktop installed` checks the installed app as a black box without disturbing a running copy: it reads the fuse wire, then launches the app with `--inspect=0`, with `--remote-debugging-port=0` and with `ELECTRON_RUN_AS_NODE=1`, each with a disposable profile, and proves each launch exits refused before it creates its profile; it launches it once more with `NODE_OPTIONS=--inspect=0 --require <payload>` and proves the app starts as usual and quits cleanly. No launch may open a debugging endpoint, run the payload, or change the running copies or the owner's profile. Run it over SSH after the owner installs a build that changes the lock: the `NODE_OPTIONS` launch starts the app, and in the logged-in session a freshly signed build asks for the Keychain before its first use.

The installed app keeps its profile in `~/Library/Application Support/Porcelain/`: `credentials.enc` (the remote computers, encrypted through the Keychain), `window.json`, and `server/`, the server's own database and owner socket. Its server writes to `~/Library/Logs/Porcelain/server.log`, moved aside to `server.log.1` at the size `LIMITS.desktop.serverLogBytes` sets. `--data-directory <folder>` moves the profile, and the logs to `<folder>/logs`; `--project-home <folder>` sets where Open Project starts. Development servers keep their own data.
