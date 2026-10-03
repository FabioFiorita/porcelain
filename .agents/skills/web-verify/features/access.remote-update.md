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
  - "Name of this computer"
  - "Save"
  - "Ways in"
  - "Local network"
  - "Devices"
  - "Device name"
  - "Create pairing link"
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

`C=.agents/skills/web-verify/scripts/cli`. Two desktop instances, set up as below. Every disposable server offers `1.0.0` → `1.1.0` through a scripted updater whose first attempt fails and second succeeds.

### Setup: a second computer

Two desktop instances stand in for two computers: B (the remote computer) and A (this desktop app). Every command then needs `--instance <id>`.

1. `$C start --desktop` (B), then `$C start --desktop` (A). Note each instance id (`$B`, `$A`), B's web URL from its `web http://127.0.0.1:<port>` line (`$B_WEB`) and each `repository` path (`$REPO_B`, `$REPO_A`).
2. Name B so its rows differ from A's (both default to the host name): `$C --instance $B open /settings/computer`, `$C --instance $B fill --role textbox --name "Name of this computer" "Remote box"`, `$C --instance $B click --role button --name "Save"`.
   Look for: Page Title "Settings · Remote box".
3. Mint a pairing link on B: `$C --instance $B click --role button --name "Ways in"`, `$C --instance $B click --role switch --name "Local network"`, `$C --instance $B click --role button --name "Devices"`, `$C --instance $B fill --role textbox --name "Device name" "Remote computer"`, `$C --instance $B click --role button --name "Create pairing link"`.
   Look for: a paragraph holding `http://192.168.1.20:<port>/pair#c=pcp_…&e=…`. `192.168.1.20` is B's fake LAN address and nothing listens there, so build `$LINK` from `$B_WEB` followed by the `/pair#…` part. The link works once, for a few minutes.
4. Add B on A: `$C --instance $A open /settings/remotes`, `$C --instance $A fill --role textbox --name "Pairing link" "$LINK"`, `$C --instance $A click --role button --name "Add"`.
   Look for: list "Remote computers" with listitem "Remote box" containing "Online" and "http://127.0.0.1:<B port> · Porcelain 1.0.0".

### An app the remote does not trust is told how to get trusted

1. `$C --instance $A open /settings/computer`
   Look for: group "Updates" (this computer: "Porcelain 1.0.0", "Porcelain 1.1.0 is available.", button "Update to 1.1.0"); group "Remote computers" with list "Remote computer updates" holding listitem "Remote box" with "Porcelain 1.0.0", "Porcelain 1.1.0 is available." and "Trust this app on Remote box to update it from here: run porcelain trust <device id> there."; no "Update to 1.1.0" button in that row.

### A trusted app starts the update there

2. Trust A on B: `$C --instance $B open /settings/devices`, `$C --instance $B click --role switch --name "Remote computer can update Porcelain"`
   Look for: switch "Remote computer can update Porcelain" [checked] on listitem "Remote computer".
3. `$C --instance $A open /settings/computer`
   Look for: listitem "Remote box" now shows button "Update to 1.1.0" and no "Trust this app on …" text. The page now holds two buttons named "Update to 1.1.0" (this computer's and the remote's), so `click --name "Update to 1.1.0"` is refused as ambiguous.
4. Reach the remote's button with the keyboard: `$C --instance $A click --role textbox --name "Name of this computer"`, `$C --instance $A press Tab` (skips the disabled "Save", lands on this computer's "Update to 1.1.0"), `$C --instance $A press Tab` (the remote's), `$C --instance $A press Enter`
   Look for (after about 3 s): in listitem "Remote box", alert "The update to 1.1.0 failed, so Porcelain still runs 1.0.0." with "Could not install the persistent runtime: npm could not reach the registry", and button "Update to 1.1.0" offered again; group "Updates" (this computer) unchanged.
5. Repeat step 4.
   Look for (after about 4 s): listitem "Remote box" reads "Porcelain 1.1.0", alert "Updated from 1.0.0 to 1.1.0." and "This is the newest version."; this computer still reads "Porcelain 1.0.0".
6. `$C --instance $B open /settings/computer`
   Look for: B's own group "Updates" reads "Porcelain 1.1.0", "Updated from 1.0.0 to 1.1.0." and "This is the newest version.": the update ran on the remote.

## What proves it works

- Steps 4 to 6: the row's progress text comes from the remote's `GET /api/service/update`, polled every 1 s (`SERVICE_UPDATE_POLL_MS`) while it runs. `$C network` lists the cross-origin `POST <remote>/api/service/update` with status 202. B's own Settings → This computer (step 6) reads the result back from the remote server.
- `apps/web/spec/e2e/access-remote-update.desktop.e2e.ts`: adds the remote ("Remote journey computer") from an untrusted link. It checks that its row in "Remote computer updates" shows the `Trust this app on … run porcelain trust <id> there.` text and no `Update to <latest>` button. Then it adds it again from a trusted link, clicks `Update to <latest>` in that row, and polls the remote until its update is running or has a last attempt.

## Gotchas

- Name collision: this computer's own update section shows a button "Update to 1.1.0" too (this browser reaches its server over loopback, so it may update it). Once the remote is trusted, `--name "Update to 1.1.0"` matches two buttons and the CLI refuses it; step 4's keyboard path reaches the remote's button. Clicking this computer's button by mistake starts this server's own scripted update (`access.service-update`). CLI gap for a direct click: `cli click --within-role listitem --within-name "Remote box" --role button --name "Update to 1.1.0"`.
- Both disposable servers default to the same host name. Rename the remote under its This computer section, or the rows are indistinguishable.
- A remote that is not online shows "<status>. Its update shows here once it answers." in place of the update.
- Desktop shell only. Without the desktop bridge, This computer shows the service update rather than the desktop app's own update (`desktopAppUpdate()` is undefined).
