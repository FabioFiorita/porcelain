---
route: /settings/$section/$environmentId
shell: desktop
selectors:
  - "Toggle Sidebar"
  - "Settings"
  - "This computer"
  - "Remote computers"
  - "Pairing link"
  - "Add"
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

A desktop computer’s Settings detail shows its existing remote update controls. An app the host does not trust sees the `porcelain trust <device id>` instruction. A trusted app can start the update on that computer. The compact Remote computers list has no update controls.

## Driving it

Start `$C start --desktop`, pair the browser, then `$C remote start`. The disposable remote offers 1.0.0 → 1.1.0 through a scripted updater whose first attempt fails and second succeeds.

1. Open Settings › Remote computers. Paste the link from `$C remote pairing-link` in Pairing link and choose Add. Select the Remote journey computer row button. The URL is `/settings/remotes/<environmentId>`.
2. On detail, wait for Online. Observe Porcelain 1.0.0, the available 1.1.0 update, and the instruction to trust this app on the host. There is no Update to 1.1.0 button.
3. Return to the list with Back. Issue `$C remote pairing-link --trusted` and add that link; pairing again replaces this environment’s saved connection. Open its row again. The existing trusted-device controls now offer Update to 1.1.0.
4. Click Update to 1.1.0. Observe the failure explaining that Porcelain still runs 1.0.0, then the offered update button. Its cross-origin POST /api/service/update answers 202; progress comes from that host’s GET /api/service/update.
5. Click the offered update again. Observe Updated from 1.0.0 to 1.1.0 and This is the newest version.
6. Open This computer. Its own update still reports 1.0.0: the action targeted the remote.

## Proof and limits

The named E2E file pairs untrusted, opens detail, asserts the trust instruction and absent update button, pairs trusted, opens detail and starts the update. It reads the remote’s update state to prove targeting. Offline computers retain saved details but offer no update controls. Native bridge and app-update behavior require desktop verification; browser fleet management remains out of scope.
