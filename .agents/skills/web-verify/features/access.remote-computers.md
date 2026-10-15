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
  - "Forget on this app"
  - "Read saved environments"
tests:
  - apps/web/spec/e2e/access-remote-computers.desktop.e2e.ts
api:
  - GET /api/environment
  - GET /api/session
  - POST /api/pair
---

# access.remote-computers

## What it is

Desktop Settings › Remote computers pairs this app with other computers from one-use links. Its compact list shows each name, address and short environment ID as a navigation target; detailed status, version, update and forgetting belong on [computer detail](access.remote-detail.md). Browser mode keeps its single-host Settings and has no fleet list.

## Driving it

Start `$C start --desktop` and pair a fresh browser context using the card’s pairing command. This verifies desktop-mode views; the actual credential bridge requires desktop verification.

1. Open Settings › Remote computers, or `/settings/remotes`. With no saved computers, observe No remote computers yet and a disabled Add button.
2. Enter `not a link` in Pairing link and choose Add. Observe Paste the whole link porcelain pair printed, starting with http. The list stays empty.
3. Enter a pairing link for this instance’s environment ID. Observe That link is for this computer. It is rejected before contacting another host.
4. Run `$C remote start`, then issue `$C remote pairing-link` and add that link. Observe the Remote journey computer listitem with its address and short environment ID. Select its button to see Online, full identity and version on `/settings/remotes/<environmentId>`.
5. Return to the list with Back and reuse the same link. Observe That link was not accepted. It works once, for a few minutes; run porcelain pair again. The computer stays saved once.
6. Reload the list and open its detail again. The saved connection still works. `$C server devices --remote` shows the Remote computer device whose own credential this app uses.
7. On detail, choose Forget on this app. Observe the return to the list and No remote computers yet. This action does not revoke host credentials or stop sharing.

## Proof and limits

The named E2E file covers malformed and local links, real cross-origin pairing, reused links, persisted credential rejection after revocation, and forgetting from detail. It observes the remote’s device registration and the environment-ID detail URL. The detail regression covers search, filter, scroll, focus, offline presentation, exact-computer entry points and unsaved drafts.

An unreadable saved store blocks changes and is never overwritten. Allow credential access and choose Read saved environments. In desktop-mode web verification the existing development fallback uses origin-local storage; this is not browser fleet product support. Native proof uses the app’s encrypted credential bridge.
