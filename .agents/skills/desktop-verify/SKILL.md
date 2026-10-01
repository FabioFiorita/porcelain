---
name: desktop-verify
description: Build, sign and install the local Mac app, find where it keeps its data and logs, and prove it by driving the installed app with Playwright. Use when changing apps/desktop, the desktop bridge contract, or web behaviour only the desktop shell shows.
---

# Desktop verification

The Mac app is Electron around the web and the server. Its host process lives in `apps/desktop/src`; its renderer is the web built in Vite's `desktop` mode, served at `porcelain://app`; its server runs in an Electron utility process.

## On any host

`pnpm check` typechecks the desktop app and runs the specs beside it in `apps/desktop/src`. A guard of the host process (who may call the bridge, what the protocol forwards, which links leave the app) is a pure function in `apps/desktop/src/rules/` with a spec that fails when the guard is deleted.

A journey through UI only the desktop shell shows runs in Chromium with `shell: 'desktop'` (see `web-verify`); it gets the desktop web mode but no bridge, so it cannot prove the bridge, the protocol or the native menus. `pnpm dev --desktop` shows the web as the app does. The HTTP net and the journeys sandbox their servers with Linux tools, so run them on Linux.

## On a Mac

The build, the install and the proof run only on macOS, arm64 or x64, with the Node version in `.node-version`, pnpm 12.3.4, Git and the Xcode Command Line Tools.

```sh
pnpm install --frozen-lockfile
pnpm desktop:install
pnpm verify:desktop installed-project
pnpm verify:desktop bridge-capabilities
pnpm verify:desktop review-summaries
```

`pnpm desktop:build` builds `dist/desktop/Porcelain-darwin-<arch>/Porcelain.app` only. `pnpm desktop:install` builds it, verifies its signature and replaces `/Applications/Porcelain.app`, keeping the previous app in `~/Library/Caches/Porcelain/build-backups.noindex/`. The build packages the web, bundles the host, its preload and the server with esbuild, rebuilds `better-sqlite3` for the Electron version pinned in `apps/desktop/package.json` in `dist/desktop/stage`, and keeps native modules and the macOS trash executable outside the ASAR archive. It signs ad hoc: there is no certificate, notarization, updater or distribution, and the app needs no separate Node or development server.

The installed app keeps its profile in `~/Library/Application Support/Porcelain/`: `credentials.enc` (the remote computers, encrypted through the Keychain), `window.json`, and `server/`, the server's own database and owner socket. Its server writes to `~/Library/Logs/Porcelain/server.log`, moved aside to `server.log.1` at the size `LIMITS.desktop.serverLogBytes` sets. `--data-directory <folder>` moves the profile, and the logs to `<folder>/logs`; `--project-home <folder>` sets where Open Project starts. Development servers keep their own data.

## The proof

`pnpm verify:desktop <feature>` launches the installed app, never a build in the checkout, with a disposable profile and a disposable Git repository, drives it with Playwright's Electron support, and prints `PASS <feature>` and its evidence folder, `dist/desktop/evidence/<time>-<feature>/`: `result.json` with the promise and what was proven, screenshots, and `failure.txt` with the stack when it fails. Without a feature it runs `installed-project`.

The features and their promises are in `scripts/feature-map.ts` beside the runner. A changed desktop behaviour changes its feature's promise and its checks in the same commit. Supply native dialogs at Electron's boundary from `app.evaluate`, read renderer state with typed functions against `DesktopBridge` from `@porcelain/contracts/desktop` (lint refuses source text passed to `evaluate`), and fail with a sentence that names the broken promise.

After a desktop change, run `pnpm check` where you are, then on a Mac install once and run each affected feature once. Installing replaces the owner's app; do it once per change, at the end.
