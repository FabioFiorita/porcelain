---
route: /settings/$section
shell: desktop
selectors:
  - "Toggle Sidebar"
  - "Settings"
  - "This computer"
  - "Remote computers"
  - "Pairing link"
  - "Add"
  - "Remote computer updates"
  - "Trust this app on "
  - "can update Porcelain"
  - "Update to "
tests:
  - apps/web/spec/e2e/access-remote-update.desktop.e2e.ts
api:
  - GET /api/service/update
  - POST /api/service/update
---

# access.remote-update

## What it is

Settings → This computer lists each remote computer's Porcelain update under "Remote computers". An app that remote does not trust is told how to get trusted there (`porcelain trust <device id>`). A trusted app gets an `Update to <version>` button that starts the update on that computer.

## How a user reaches it

- Workspace → `Toggle Sidebar` (phone width) → `Settings` (navigator footer) → `This computer` → the "Remote computers" group → the row named after the remote → `Update to <version>`.
- Keyboard: `Alt+Shift+S` on the workspace (focus outside a text field) opens Settings, then `This computer`.
- Route: `/settings/computer` (desktop shell only). The group shows only once a remote is added under `Remote computers` (see `access.remote-computers`).

## Driving it

`$C start --desktop`; pair your browser using the card’s pairing-link command. Every disposable server offers `1.0.0` → `1.1.0` through a scripted updater whose first attempt fails and second succeeds.

### Setup: a second computer, added from an untrusted link

1. `$C remote start`
   Look for: "remote computer Remote journey computer, project remote-sample" and its address.
2. `LINK=$($C remote pairing-link | head -1)`, Navigate to `/settings/remotes` on the card’s web URL (full page load), replace the contents of textbox named `Pairing link` with the expanded value `$LINK`, click button named `Add`, then wait for text 'Online' to be visible
   Look for: listitem "Remote journey computer" with "Online"; Inspect HTTP requests and responses lists `POST <remote>/api/pair` 200 and `GET <remote>/api/environment` 200.

### An app the remote does not trust is told how to get trusted

3. Navigate to `/settings/computer` on the card’s web URL (full page load), then wait for text '/Trust this app on/' to be visible
   Look for: group "Updates" (this computer: "Porcelain 1.0.0", "Porcelain 1.1.0 is available.", button "Update to 1.1.0"); group "Remote computers" with list "Remote computer updates" holding listitem "Remote journey computer" with "Porcelain 1.0.0", "Porcelain 1.1.0 is available." and "Trust this app on Remote journey computer to update it from here: run porcelain trust <device id> there."; no "Update to 1.1.0" button in that row.

### A trusted app starts the update there

4. Add it again from a trusted link: Navigate to `/settings/remotes` on the card’s web URL (full page load), click button named `Remove Remote journey computer`, `TRUSTED=$($C remote pairing-link --trusted | head -1)`, replace the contents of textbox named `Pairing link` with the expanded value `$TRUSTED`, click button named `Add`, then wait for text 'Online' to be visible
   Look for: listitem "Remote journey computer" with "Online" again (`--trusted` mints the link a device that may update Porcelain gets, as `porcelain trust` grants).
5. Navigate to `/settings/computer` on the card’s web URL (full page load), then wait for button named `Update to 1.1.0` within listitem named `Remote journey computer` to be visible
   Look for: listitem "Remote journey computer" now shows button "Update to 1.1.0" and no "Trust this app on …" text. The page holds two buttons named `Update to 1.1.0` (this computer's and the remote's), so address the remote's inside its listitem.
6. Click button named `Update to 1.1.0` within listitem named `Remote journey computer`, then wait for text '/The update to 1.1.0 failed/' to be visible
   Look for: in listitem "Remote journey computer", alert "The update to 1.1.0 failed, so Porcelain still runs 1.0.0." with "Could not install the persistent runtime: npm could not reach the registry", and button "Update to 1.1.0" offered again; group "Updates" (this computer) unchanged.
7. Repeat the click, then wait for text '/Updated from 1.0.0 to 1.1.0/' to be visible
   Look for: listitem "Remote journey computer" reads "Porcelain 1.1.0", alert "Updated from 1.0.0 to 1.1.0." and "This is the newest version."; this computer's group "Updates" still reads "Porcelain 1.0.0" with its own "Update to 1.1.0": the update ran on the remote.

## What proves it works

- Steps 6 and 7: the row's progress text comes from the remote's `GET /api/service/update`, polled every 1 s (`SERVICE_UPDATE_POLL_MS`) while it runs. Inspect HTTP requests and responses lists the cross-origin `POST <remote>/api/service/update` answered 202, once per click.
- `apps/web/spec/e2e/access-remote-update.desktop.e2e.ts`: adds the remote ("Remote journey computer") from an untrusted link. It checks that its row in "Remote computer updates" shows the `Trust this app on … run porcelain trust <id> there.` text and no `Update to <latest>` button. Then it adds it again from a trusted link, clicks `Update to <latest>` in that row, and polls the remote until its update is running or has a last attempt.

## Gotchas

- Name collision: this computer's own update section shows a button "Update to 1.1.0" too (this browser reaches its server over loopback, so it may update it). Once the remote is trusted, name `Update to 1.1.0` alone matches two buttons and is refused; scope it with listitem "Remote journey computer". Clicking this computer's button by mistake starts this server's own scripted update (`access.service-update`).
- A remote that is not online shows "<status>. Its update shows here once it answers." in place of the update.
- Desktop shell only. Without the desktop bridge, This computer shows the service update rather than the desktop app's own update (`desktopAppUpdate()` is undefined).
