---
screen: /computer
selectors:
  - 'This computer'
  - 'Computer unavailable'
  - 'Devices'
  - 'Pair a device'
  - 'Ways in'
  - 'Local network'
  - 'Tailscale'
  - 'Cloudflare tunnel'
tests:
  - packages/client/src/features/access/commands/share.spec.ts
api:
  - GET /api/remote-access
  - PATCH /api/remote-access
---

# access.computer

A saved computer's page, pushed in the Settings stack from Computers → This computer. Its header names the computer; the page shows its address, Ways in, Devices and Pair a device. Ways in shows that computer's local network, Tailscale and Cloudflare tunnel when its owner let this phone edit ways in; the way in the phone is connected through is locked with an explanation, and without the permission it says this device cannot see or change ways in; over a connection to the computer's own address (127.0.0.1, localhost or the emulator's 10.0.2.2, as `adb reverse` and the Android emulator connect) it says ways in cannot be seen or changed over this connection. Device administration belongs to a browser on the computer running Porcelain, so the phone shows that requirement instead of host-only controls.

## How to get to it (user POV)

- Settings → Computers → This computer on a saved computer's row.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open Computers → This computer on a paired computer. Expect a pushed page titled with that computer's name, its address, Devices and Pair a device, and instructions to manage devices or create a link in a browser on that computer. Native Back (and the iOS edge swipe) returns to Computers; there is no Close button and no tab bar around it. With multiple computers open each one and verify its identity.
2. Forget the computer from another path while its page is in the stack, then return to it: Computer unavailable explains it is no longer paired.
3. On tablets verify landscape and portrait: the page pushes inside the Settings modal and stays bounded.

Automated coverage: `share.spec.ts`.

## Gotchas

- Grant or remove "<device> can edit ways in" from a host browser's Paired devices, then reopen the page to see the editor appear or disappear; the phone cannot grant it to itself.
- The page names the selected host, not the phone. Native clients cannot administer devices or create pairing links; the server requires a local browser.
