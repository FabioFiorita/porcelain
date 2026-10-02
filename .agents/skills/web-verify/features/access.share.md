---
route: /settings/$section
shell: desktop
selectors:
  - "Toggle Sidebar"
  - "Settings"
  - "Devices"
  - "Ways in"
  - "Local network"
  - "Device name"
  - "Create pairing link"
  - "Pairing QR code"
  - "Pairing link"
  - "My phone"
tests:
  - apps/web/spec/e2e/access-share.desktop.e2e.ts
api:
  - GET /api/access
  - GET /api/inventory
  - GET /api/remote-access
  - PATCH /api/remote-access
  - POST /api/access/revoke
  - POST /api/pair
  - POST /api/pairings
---

# access.share

## What it is

On the computer that runs Porcelain, Settings → Devices creates a one-time pairing link with its QR code for the one way in the device will work through, lists the paired devices with the way in each is bound to and the pending links with this browser marked, and revokes another device.

## How a user reaches it

- sidebar → Settings → Devices
- Shortcut: `Alt+Shift+S`

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start --desktop`.

### Settings → Devices creates a one-time pairing link for one way in with its QR code, lists the paired devices with the way in each works through and revokes one

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Settings"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Devices"`
   Look for: the main “Settings” shows.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Ways in"`
   Look for: the page settles; take a snapshot to read what it shows.
5. `.agents/skills/web-verify/scripts/cli click --role switch --name "Local network"`
   Look for: the text “/^http:\/\/192\.168\.1\.20:\d+$/” shows.
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Devices"`
   Look for: the main “Settings” shows.
7. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Device name" "My phone"`
   Look for: the page settles; take a snapshot to read what it shows.
8. `.agents/skills/web-verify/scripts/cli click --role button --name "Create pairing link"`
   Look for: the img “Pairing QR code” shows; the field “Pairing link” reads /^http:\/\/192\.168\.1\.20:\d+\/pair#c=pcp_/,; the listitem “Journey browser” reads /This browserThis computer/; the button “Revoke Journey browser” is gone; the listitem “My phone” reads /Pending link/.
9. `.agents/skills/web-verify/scripts/cli click --role button --name "Revoke Development setup"`
   Look for: the listitem “Development setup” is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/access-share.desktop.e2e.ts` (Playwright e2e): Settings → Devices creates a one-time pairing link for one way in with its QR code, lists the paired devices with the way in each works through and revokes one.
- The tests read back what the server kept through the kit: `server.devices()`, `server.pendingLinks()`.

## Gotchas

- Only the desktop app shows this; start the instance with `.agents/skills/web-verify/scripts/cli start --desktop`, which serves the web in the desktop Vite mode.
