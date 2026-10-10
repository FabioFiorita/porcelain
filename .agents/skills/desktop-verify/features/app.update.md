---
selectors:
  - 'Check for updates'
  - 'Checking for a new version…'
  - 'This is the newest version of the app.'
  - 'This build updates by reinstalling; there is no update feed yet.'
tests:
  - apps/desktop/src/adapters/app-update.spec.ts
  - apps/web/src/features/access/rules/app-update.spec.ts
  - apps/web/spec/e2e/access-app-update.desktop.e2e.ts
  - apps/web/spec/e2e/access-app-update.e2e.ts
  - apps/desktop/spec/e2e/menus.e2e.ts
api: []
---

# app.update

## What it is

The release Mac app checks its own update feed from Settings and installs an offered release. Check for updates shows checking, the newest-version result, an available release with Update to its version, or the updater's error. Checking is disabled while checking, downloading, ready or installing. Reloading the renderer or asking to install twice preserves the original download and results in one restart.

## How a user reaches it

- Sidebar › Settings › This computer › Updates.
- Porcelain › Settings… or ⌘, opens the same Settings page.
- Back or Escape leaves Settings; there is no update context-menu item or separate update shortcut.

## Driving it

Start a disposable Porcelain Dev instance with the desktop-verify skill. Open Settings with the native open-settings menu item, choose This computer and observe the app version and reinstall message. Check for updates must be absent: this unpackaged app has no release feed. Back returns to the app.

For the enabled control, run the named web desktop-shell regression file. Its typed desktop bridge fixture is the updater port: hold a manual check, observe checking and the disabled button, then answer with idle, error or available. Observe the result, check again after an error, and install the offered release. During the download the Install control disappears and Check for updates is disabled. The desktop file verifies disabled builds; the named ordinary web regression verifies that web pages hide the native check control.

## What proves it works

- `apps/desktop/src/adapters/app-update.spec.ts`: available and current-version checks, null as unavailable, check/download errors, local-build refusal, checking during download/ready/installing and repeated installs preserve one download and one installation.
- `apps/web/src/features/access/rules/app-update.spec.ts`: progress and no-update wording for the supported states.
- `apps/web/spec/e2e/access-app-update.desktop.e2e.ts`: manual check results and recovery, Install, busy controls, release capability gating and Back through the desktop-shell renderer with an updater-port fixture.
- `apps/desktop/spec/e2e/menus.e2e.ts`: native Settings entry, app version, disabled update feed and no manual check in disposable Porcelain Dev.

## Gotchas

- The preload capability comes from the same packaged release-feed decision that creates the main-process updater; desktop-shell presence alone does not enable the control.
- The update flow belongs to the Mac app, regardless of which local, LAN or remote server the renderer connects to; it does not update a connected server.
- Do not enable a real update feed in Porcelain Dev or use the installed app for verification. Signed release download/restart assurance remains a release check; the fixture journey does not prove it.
