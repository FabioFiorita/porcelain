---
route: /settings/$section
shell: desktop
selectors:
  - "Toggle Sidebar"
  - "Settings"
  - "Ways in"
  - "Local network"
  - "Devices"
  - "Device name"
  - "The paired device can update Porcelain"
  - "Create pairing link"
tests:
  - apps/web/spec/e2e/access-device-trust.desktop.e2e.ts
api:
  - GET /api/access
  - POST /api/access/revoke
  - POST /api/access/trust
  - POST /api/pairings
---

# access.device-trust

## What it is

On Devices the owner lets a paired device update Porcelain and takes it back, and creates a pairing link whose device may update Porcelain.

## How a user reaches it

- Toggle Sidebar → Settings → Devices → … can update Porcelain

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start --desktop`.

### On Devices the owner lets a paired device update Porcelain and creates a pairing link whose device may update it too

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Settings"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Ways in"`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role switch --name "Local network"`
   Look for: the text “/^http:\/\/192\.168\.1\.20:\d+$/” shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Devices"`
   Look for: the switch “Development setup can update Porcelain” is checked.
6. `.agents/skills/web-verify/scripts/cli click --role switch --name "Development setup can update Porcelain"`
   Look for: the switch “Development setup can update Porcelain” is checked.
7. `.agents/skills/web-verify/scripts/cli click --role switch --name "Development setup can update Porcelain"`
   Look for: the page settles; take a snapshot to read what it shows.
8. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Device name" "Release laptop"`
   Look for: the page settles; take a snapshot to read what it shows.
9. `.agents/skills/web-verify/scripts/cli click --role switch --name "The paired device can update Porcelain"`
   Look for: the page settles; take a snapshot to read what it shows.
10. `.agents/skills/web-verify/scripts/cli click --role button --name "Create pairing link"`
   Look for: the page settles; take a snapshot to read what it shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/access-device-trust.desktop.e2e.ts` (Playwright e2e): on Devices the owner lets a paired device update Porcelain and creates a pairing link whose device may update it too.
- The tests read back what the server kept through the kit: `server.devices()`, `server.pendingLinks()`.

## Gotchas

- Only the desktop app shows this; start the instance with `.agents/skills/web-verify/scripts/cli start --desktop`, which serves the web in the desktop Vite mode.
