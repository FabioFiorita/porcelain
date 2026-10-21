---
selectors:
  - 'Check for updates'
  - 'Checking for a new version…'
  - 'This is the newest version of the app.'
  - 'This build updates by reinstalling; there is no update feed yet.'
  - 'Could not check for an app update.'
tests:
  - apps/desktop/src/adapters/app-update.spec.ts
  - apps/web/src/features/access/rules/app-update.spec.ts
  - apps/web/spec/e2e/access-app-update.desktop.e2e.ts
  - apps/desktop/spec/e2e/menus.e2e.ts
api: []
---

# app.update

## What it is

The release Mac app checks its own update feed from Settings and installs an offered release. Check for updates shows checking, the newest-version result, an available release with Restart to update, or the updater's error. A later check that the bridge rejects shows Could not check for an app update until the next check starts. Checking is disabled while checking, downloading, ready or installing. The offered release appears as soon as the main process publishes it; Install stays disabled until the check finishes, and the main process refuses installation unless a release is currently available, including after a failed download. Reloading the renderer or asking to install twice preserves the original download and results in one restart.

## How a user reaches it

- Sidebar › Settings › Computers › This computer.
- Porcelain › Settings… or ⌘, opens the same Settings page.
- The sidebar footer Update badge appears when an update exists and opens an upward Updates available popover with the Mac app and eligible computers. Manage computers opens Settings → Computers.
- Back returns through computer details; Escape leaves Settings. There is no separate update shortcut.

## Driving it

Start a disposable Porcelain Dev instance with the desktop-verify skill. Open Settings with the native open-settings menu item, choose Computers, then Open This computer and observe the app version and reinstall message. Check for updates must be absent: this unpackaged app has no release feed. Back returns to Computers; another Back or Escape returns to the app.

For the enabled control, run the named web desktop-shell regression file. Its typed desktop bridge fixture is the updater port: hold a manual check, observe checking and the disabled button, then answer with idle, error or available, or reject the check. Observe the result, check again after an error, and install the offered release. During the download the Install control disappears and Check for updates is disabled. The desktop file also verifies disabled builds; the named rule spec proves release-feed and desktop-shell visibility decisions.

## What proves it works

- `apps/desktop/src/adapters/app-update.spec.ts`: available and current-version checks, null as unavailable, failed checks clear the offered release, check/download errors, local-build refusal, installation refused during a check and after a failed download, checking during download/ready/installing and repeated installs preserve one download and one installation.
- `apps/web/src/features/access/rules/app-update.spec.ts`: progress and no-update wording for the supported states, and check-button visibility for release, development and web capabilities.
- `apps/web/spec/e2e/access-app-update.desktop.e2e.ts`: manual check results, a rejected check and recovery, Install, busy controls, release capability gating and Back through the desktop-shell renderer with an updater-port fixture.
- `apps/desktop/spec/e2e/menus.e2e.ts`: native Settings entry, app version, disabled update feed and no manual check in disposable Porcelain Dev.

## Gotchas

- The preload capability comes from the same packaged release-feed decision that creates the main-process updater; desktop-shell presence alone does not enable the control.
- The update flow belongs to the Mac app, regardless of which local, LAN or remote server the renderer connects to; it does not update a connected server.
- Do not enable a real update feed in Porcelain Dev or use the installed app for verification. Signed release download/restart assurance remains a release check; the fixture journey does not prove it.
- At release verification, confirm a signed packaged Mac build includes `app-update.yml`, exposes the feed capability and shows Check for updates in Settings. Run a check and observe its result before testing download/signature/restart. Unpackaged desktop tests cannot prove this packaging path; do not launch the installed app during development verification.
