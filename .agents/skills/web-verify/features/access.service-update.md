# access.service-update

## What it is

Settings → Updates shows the running Porcelain version and the newer one the server offers. Updating shows its progress; a failed update says why and that Porcelain still runs the version it had; a successful one ends on the new version with an offer to reload.

## How a user reaches it

- Sidebar (phone width: `Toggle Sidebar` first) → `Settings` → `Updates` section → `Update to <version>`.
- `Alt+Shift+S` opens Settings, then `Updates`.
- Route `/settings/updates`.
- Web mode only: `start --desktop` has no Updates section (the desktop app updates itself).

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start` (not `--desktop`). The disposable server offers a scripted update: running `1.0.0`, offered `1.1.0`, managed, and this browser may update (it reaches the server from 127.0.0.1). Its first attempt fails with "Could not install the persistent runtime: npm could not reach the registry"; its second succeeds. Each step takes 400 ms; the page polls every second while an update runs.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

None.

1. Open `/` on the instance web URL, click the button named 'Toggle Sidebar', click the button named 'Settings'
   Look for: main "Settings", Page URL `/settings/appearance`.
2. Click the button named 'Updates'
   Look for: Page URL `/settings/updates`; text "Porcelain 1.0.0"; text "Porcelain 1.1.0 is available."; button "Update to 1.1.0".
3. Click the button named 'Update to 1.1.0'
   Look for (after about 2 s): a destructive alert "The update to 1.1.0 failed, so Porcelain still runs 1.0.0." followed by "Could not install the persistent runtime: npm could not reach the registry"; text "Porcelain 1.0.0"; button "Update to 1.1.0" still offered. "Downloading 1.1.0…" / "Installing 1.1.0…" show only in between.
4. Click the button named 'Update to 1.1.0'
   Look for (after about 3 s; "Restarting Porcelain on 1.1.0. This page reconnects when it is back." shows first): alert "Updated from 1.0.0 to 1.1.0. Reload to use the new version here."; button "Reload"; text "Porcelain 1.1.0"; text "This is the newest version."; no "Update to" button.
5. Open `/settings/updates` on the instance web URL
   Look for: text "Porcelain 1.1.0", "Updated from 1.0.0 to 1.1.0." (without the reload sentence) and "This is the newest version."; no "Reload" button. The server kept the new version.
   Filter browser network evidence to this update journey: two `POST /api/service/update` (202) and the `GET /api/service/update` polls (200). Retain it before step 5 if the in-app browser clears request history on navigation.

## What proves it works

- The failure alert names the target, the still-running version and the updater's reason; the success ends on "Porcelain 1.1.0", "This is the newest version." and "Reload".
- Server state read back by reload (step 5): the page reports 1.1.0 from `GET /api/service/update`.
- `apps/web/spec/e2e/access-service-update.e2e.ts`: reads the offer from the server, sees "Porcelain <from>" and "Porcelain <to> is available.", clicks Update, sees Downloading/Installing progress, then the failure sentence and the server's reason; clicks again, sees progress, then "Updated from <from> to <to>. Reload to use the new version here.", "Porcelain <to>", "This is the newest version.", button "Reload", and `server.serviceUpdate().version` becomes `<to>`.

- `packages/client/src/features/access/queries/share.spec.ts` proves that a failed read retains the confirmed running update, polling resumes after the failure, reads never overlap, and unmounting cancels the active request. It also covers the first restart read failing immediately after an accepted update.

## Gotchas

- The scripted server has exactly two attempts and keeps the result for the instance's life: after step 4 the offer is gone (1.1.0 is newest). To drive it again, `$C stop` and `$C start`.
- Progress text ("Downloading 1.1.0…", "Installing 1.1.0…", "Restarting Porcelain on 1.1.0. This page reconnects when it is back.") lasts about 1 to 2 s; the next inspection may land after it. Judge by the end state.
- Clicking "Reload" in step 4 reloads the page; afterwards the outcome no longer offers a reload (that sentence and button show only in the tab that started the update).
- Phone width: Settings sections are a horizontal row of buttons at the top of main "Settings".
