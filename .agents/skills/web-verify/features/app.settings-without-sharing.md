---
route: /settings/$section
selectors:
  - "Toggle Sidebar"
  - "Projects and worktrees"
  - "Settings"
  - "Settings sections"
  - "Updates"
  - "Git and agents"
  - "Appearance"
  - "Connection"
tests:
  - apps/web/spec/e2e/app-settings-without-sharing.e2e.ts
api:
  - GET /api/inventory
  - GET /api/service/update
  - POST /api/service/update
---

# app.settings-without-sharing

## What it is

The web the server serves (web mode) leaves sharing and remote computers to the desktop app: Settings opens on Updates and lists only Updates, Git and agents, Appearance and Connection, with no This computer, Ways in, Remote computers or Devices section, and the project navigator still names this computer.

## How a user reaches it

- Sidebar (phone width: `Toggle Sidebar` first) → `Settings` → section buttons in navigation "Settings sections".
- `Alt+Shift+S` opens Settings on Updates (ignored while focus is in a text field).
- Routes `/settings/updates`, `/settings/git`, `/settings/appearance`, `/settings/connection`; a desktop-only slug such as `/settings/devices` redirects to `/settings/updates`.

## Driving it

`$C start`; pair your browser using the card’s pairing-link command (web mode; `--desktop` shows the other section list).

### Setup

None. Note the computer's name with `hostname` on the machine running the instance: the server names the environment after it (it is not renamed in a fresh instance).

### Steps

1. Navigate to `/` on the card’s web URL (full page load)
   Look for: button "Toggle Sidebar"; wait for Page Title "Changes — repository".
2. Click button named `Toggle Sidebar`
   Look for: navigation "Projects and worktrees" whose header reads "Porcelain" and, under it, the `hostname` output; button "repository"; no group "This computer" (that group is desktop-only).
3. Click button named `Settings`
   Look for: Page URL `/settings/updates`; Page Title "Settings"; main "Settings"; navigation "Settings sections" holding exactly the buttons "Updates", "Git and agents", "Appearance", "Connection" and "Back"; no button "This computer", "Ways in", "Remote computers" or "Devices".
4. Look at the Updates section
   Look for: heading "Updates"; the fixture's server offers a scripted update, so the list reads "Porcelain 1.0.0", "Porcelain 1.1.0 is available." and button "Update to 1.1.0". (A server that runs outside the installed service shows "This server runs outside the installed service. Update it with npm, then run porcelain service update." instead.)
5. Inspect HTTP requests and responses
   Look for: `GET /api/service/update` with status 200.
6. Navigate to `/settings/devices` on the card’s web URL (full page load)
   Look for: Page URL `/settings/updates` (redirected); heading "Updates".

## What proves it works

- The section list in step 3 and the redirect in step 6 prove the web mode has no sharing pages; step 2 proves the navigator still shows this computer's name.
- `apps/web/spec/e2e/app-settings-without-sharing.e2e.ts` (web project, 414x896): the navigator shows `server.inventory().environment.name`; the section buttons read exactly Updates, Git and agents, Appearance, Connection, Back; Settings opens on heading "Updates" with the text `Porcelain <version from GET /api/service/update>`.

## Gotchas

- Do not click "Update to <version>" if an update is offered: it sends `POST /api/service/update` and starts a real update attempt on the disposable server.
- The text after "Porcelain " depends on the server build's version, so compare it with the version the server reports, not with a fixed string.
- Phone width: the navigator is in a sheet; click `Toggle Sidebar` before step 2's checks and before `Settings`.
