---
route: /settings/$section
shell: desktop
selectors:
  - "Toggle Sidebar"
  - "Settings"
  - "Remote computers"
  - "No remote computers yet"
  - "Pairing link"
  - "Add"
  - "Paste the whole link porcelain pair printed, starting with http."
  - "That link is for this computer."
  - "Online"
  - "Remove"
  - "Name of this computer"
  - "Save"
  - "Ways in"
  - "Local network"
  - "Devices"
  - "Device name"
  - "Create pairing link"
tests:
  - apps/web/spec/e2e/access-remote-computers.desktop.e2e.ts
api:
  - GET /api/environment
  - POST /api/pair
---

# access.remote-computers

## What it is

The desktop app pairs with another Porcelain from the link `porcelain pair` prints. It talks to that computer across origins with its own credential and shows it online. It refuses an unreadable link, a used or bad code and a link for this computer, and it forgets a remote on Remove.

## How a user reaches it

- Workspace → `Toggle Sidebar` (phone width) → `Settings` (navigator footer) → `Remote computers`.
- The navigator's remote-computer menus open the same section (`onOpenRemotes` → `/settings/remotes`).
- Route: `/settings/remotes` (desktop shell only).
- Controls: textbox "Pairing link" + `Add` (or `Enter`); `Remove <computer name>` on each row.

## Driving it

`C=.agents/skills/web-verify/scripts/cli`. Steps 1–7 need one `$C start --desktop` instance (A); steps 8–13 need the second computer from the setup below. With two instances live, add `--instance $A` to every A command.

### Refusals (A alone)

1. `$C open /settings/remotes`
   Look for: heading "Remote computers"; the text "No remote computers yet"; button "Add" disabled.
2. `$C fill --role textbox --name "Pairing link" "not a link"`
   Look for: button "Add" enabled.
3. `$C click --role button --name "Add"`
   Look for: alert "Paste the whole link porcelain pair printed, starting with http."
4. `$C fill --role textbox --name "Pairing link" "http://127.0.0.1:9/pair#c=pcp_unused&e=$ENV"`, where `$ENV` is this computer's environment id: the `e=` value of a link A's own Settings → Devices mints (Ways in → "Local network" on, then "Create pairing link"), or `curl -s "<A web URL>/api/health"`.
   Look for: the previous alert is gone.
5. `$C click --role button --name "Add"`
   Look for: alert "That link is for this computer." (checked before any request).
6. `$C fill --role textbox --name "Pairing link" "<A web URL>/pair#c=pcp_bogus&e=another-computer"`
   Look for: the previous alert is gone.
7. `$C click --role button --name "Add"`
   Look for: alert "That link was not accepted. It works once, for a few minutes; run porcelain pair again." (`POST /api/pair` refused the code; a used link shows the same message).

### Setup: a second computer

Two desktop instances stand in for two computers: B (the remote computer) and A (this desktop app). Every command then needs `--instance <id>`.

1. `$C start --desktop` (B), then `$C start --desktop` (A). Note each instance id (`$B`, `$A`), B's web URL from its `web http://127.0.0.1:<port>` line (`$B_WEB`) and each `repository` path (`$REPO_B`, `$REPO_A`).
2. Name B so its rows differ from A's (both default to the host name): `$C --instance $B open /settings/computer`, `$C --instance $B fill --role textbox --name "Name of this computer" "Remote box"`, `$C --instance $B click --role button --name "Save"`.
   Look for: Page Title "Settings · Remote box".
3. Mint a pairing link on B: `$C --instance $B click --role button --name "Ways in"`, `$C --instance $B click --role switch --name "Local network"`, `$C --instance $B click --role button --name "Devices"`, `$C --instance $B fill --role textbox --name "Device name" "Remote computer"`, `$C --instance $B click --role button --name "Create pairing link"`.
   Look for: a paragraph holding `http://192.168.1.20:<port>/pair#c=pcp_…&e=…`. `192.168.1.20` is B's fake LAN address and nothing listens there, so build `$LINK` from `$B_WEB` followed by the `/pair#…` part. The link works once, for a few minutes.
4. Add B on A: `$C --instance $A open /settings/remotes`, `$C --instance $A fill --role textbox --name "Pairing link" "$LINK"`, `$C --instance $A click --role button --name "Add"`.
   Look for: list "Remote computers" with listitem "Remote box" containing "Online" and "http://127.0.0.1:<B port> · Porcelain 1.0.0".

### Pair, refuse the reused link, forget

8. Step 4 of the setup (`fill` "Pairing link" with `$LINK`, then "Add") is the pairing.
   Look for: list "Remote computers" with listitem "Remote box" containing "Online" and "http://127.0.0.1:<B port> · Porcelain 1.0.0"; textbox "Pairing link" empty again.
9. `$C --instance $A fill --role textbox --name "Pairing link" "$LINK"`, then `$C --instance $A click --role button --name "Add"`
   Look for: alert "That link was not accepted. It works once, for a few minutes; run porcelain pair again."; "Remote box" still listed once.
10. `$C --instance $A open /settings/remotes`
    Look for: listitem "Remote box" still listed with "Online" (without the desktop bridge the app keeps remotes in `localStorage`, `porcelain.remotes`).
11. `$C --instance $B open /settings/devices`
    Look for: listitem "Remote computer" (no longer "Pending link"): the remote holds A's own credential.
12. `$C --instance $A click --role button --name "Remove Remote box"`
    Look for: the text "No remote computers yet".

## What proves it works

- Steps 3, 5 and 7: each refusal shows its alert, and the list stays empty.
- Step 9: "Online" means the remote answered `GET /api/environment` with the new credential. On the remote, the device list shows the new device under the label its link was issued for. `$C network` lists the cross-origin `POST <remote>/api/pair` (200) and `GET <remote>/api/environment` (200).
- `apps/web/spec/e2e/access-remote-computers.desktop.e2e.ts`: starts a second server named "Remote journey computer". It checks the empty state and the "Paste the whole link …" refusal, and "That link is for this computer." for a link with this server's id. With a real link from the remote, it checks the listitem named after the remote containing "Online", and that the remote's devices include "Remote computer". A reused link gets "That link was not accepted …". `Remove <name>` brings back "No remote computers yet".

## Gotchas

- The second computer is a second `start --desktop` instance: B's Devices page mints the link and A pastes it with B's web URL in place of `192.168.1.20:<port>` (setup above, proven live). A dedicated command would still be simpler: `cli remote start` and `cli remote pairing-link`.
- Desktop shell only: without `--desktop`, Settings has no Remote computers section. The desktop bridge only changes where remotes are saved (the Keychain instead of `localStorage`). The "Saved remote computers could not be read" alert needs the bridge.
- Remote status refreshes every 30 s (`REMOTE_STATUS_REFRESH_MS`) with a 5 s timeout. Right after Add the badge may read "Checking".
- Step 7 counts as a failed pairing attempt on this server. Do not repeat it in a loop.
