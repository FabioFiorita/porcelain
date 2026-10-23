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

The release Mac app checks its own update feed from Settings and installs an offered release.

## How to get to it (user POV)

- Sidebar › Settings › Computers › This computer.
- Porcelain › Settings… or ⌘, opens the same Settings page.
- The sidebar footer Update badge appears when an update exists and opens an upward Updates available popover with the Mac app and eligible computers. Manage computers opens Settings → Computers.
- Back returns through computer details; Escape leaves Settings. There is no separate update shortcut.

## Driving it with Electron

Preconditions: [surface baseline](README.md).

1. In Porcelain Dev use native `open-settings` → Computers → Open This computer. Expect the app version and reinstall message, with no Check for updates control. Back returns to Computers, then Back/Escape to the workspace.
2. For enabled controls use `access-app-update.desktop.e2e.ts`'s typed updater-port fixture: hold Check for updates, then answer with idle, error or available, and separately reject the check. Expect checking/disabled, newest-version, release plus Restart to update, or error. Recheck after an error to recover. In the open Update popover, publish an app-feed error and click Try again: the app-check counter must increase, stale install actions stay absent while checking, and the completed check restores either the offer or No updates available. Opening Update or entering Computers must not start another app-feed check.
3. Offer a release while the check is pending: Install remains disabled until it finishes. Install once; during download Install disappears and Check for updates is disabled. Reload and submit twice; observe one download/restart. A failed check clears the offer; a failed download cannot be installed.
4. For a signed candidate in release verification, confirm `app-update.yml`, feed capability and Check for updates. Observe a check before download/signature/restart proof.

Automated coverage: `app-update.spec.ts`, `app-update.spec.ts`, `access-app-update.desktop.e2e.ts`, `menus.e2e.ts`.

## Gotchas

- The disposable app has no release feed. Never enable one or use the installed app for this journey; fixture proof does not establish signed download/restart.
- Updates belong to the Mac app even while viewing a LAN/remote server; they must not POST a server update. Desktop mode alone does not grant the release capability.
