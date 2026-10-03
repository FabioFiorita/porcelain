---
route: /settings/$section
shell: desktop
selectors:
  - "Toggle Sidebar"
  - "Settings"
  - "Ways in"
  - "Local network"
  - "Devices"
  - "Paired devices and links"
  - "can update Porcelain"
  - "Device name"
  - "The paired device can update Porcelain"
  - "Create pairing link"
  - "Pairing link"
  - "Pending link"
  - "This browser"
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

On Settings → Devices the owner lets a paired device update Porcelain and takes that back with the device's "can update Porcelain" switch, and can create a pairing link whose device may update Porcelain from the moment it pairs.

## How a user reaches it

- Workspace → `Toggle Sidebar` (phone width) → `Settings` (navigator footer) → `Devices` → the switch "<device> can update Porcelain" in the device's row.
- Keyboard: `Alt+Shift+S` on the workspace (focus outside a text field) opens Settings, then `Devices`.
- Route: `/settings/devices` (desktop shell only; the web shell redirects unknown sections to `/settings/appearance`).
- For a new device: `Ways in` → turn on a way in → `Devices` → "Device name" → switch "The paired device can update Porcelain" → `Create pairing link`.

## Driving it

Start with `$C start --desktop`, then run from the repository root with `C=.agents/skills/web-verify/scripts/cli`.

### Setup

None on disk. The default server has two paired devices: "Development setup" (the server kit's own) and "Verification browser" (this browser). Neither can update Porcelain yet.

1. `$C open /settings/ways-in`
   Look for: Page Title "Settings"; heading "Ways in"; switch "Local network" not checked.
2. `$C click --role switch --name "Local network"`
   Look for: switch "Local network" checked and the text `http://192.168.1.20:<port>` (the server's fake LAN address). A badge "Starting" may show first; run `$C snapshot` again after a second.
3. `$C click --role button --name "Devices"`
   Look for: Page URL ends `/settings/devices`; list "Paired devices and links" with listitems "Development setup" and "Verification browser"; switch "Development setup can update Porcelain" not checked.
4. `$C click --role switch --name "Development setup can update Porcelain"`
   Look for: switch "Development setup can update Porcelain" checked.
5. `$C open /settings/devices`
   Look for: after the reload, switch "Development setup can update Porcelain" is still checked (the server kept it).
6. `$C click --role switch --name "Development setup can update Porcelain"`
   Look for: the switch is not checked; `$C open /settings/devices` shows it still not checked.
7. `$C fill --role textbox --name "Device name" "Release laptop"`
   Look for: button "Create pairing link" enabled.
8. `$C click --role switch --name "The paired device can update Porcelain"`
   Look for: switch "The paired device can update Porcelain" checked.
9. `$C click --role button --name "Create pairing link"`
   Look for: img "Pairing QR code"; text "Scan on Release laptop"; the Pairing link text `http://192.168.1.20:<port>/pair#c=[redacted]&e=…`; listitem "Release laptop" containing "Pending link".
10. `$C server pending-links`
    Look for: the link labelled "Release laptop" with `"trusted": true`.

## What proves it works

- Step 5 and step 6's reload show the trust kept by the server (`GET /api/access` returns each device's `trusted`). `$C network` lists `POST /api/access/trust` with status 200 for each switch click.
- Step 10: the server holds the "Release laptop" link as trusted, so `POST /api/pairings` sent `trusted: true` (the pending row does not show trust). A device that redeems a trusted link starts trusted; that is the server's promise.
- `apps/web/spec/e2e/access-device-trust.desktop.e2e.ts`: turns on Local network, checks that the "Development setup can update Porcelain" switch starts unchecked, turns it on and polls the server until `trusted` is true, turns it off until false, then creates a trusted link for "Release laptop" and reads the server's pending links as `[['Release laptop', true]]`.

## Gotchas

- Desktop shell only: without `--desktop`, Settings has no Devices section. The desktop bridge (`window.porcelainDesktop`) is not needed here.
- Creating a pairing link needs a way in that is on (step 2). Without one, Devices shows "Turn on a way in under Ways in to pair a phone or another computer." in place of the form. The trust switches work either way.
- Local network stays on and trust changes stay for the life of the instance. `access.share` revokes "Development setup", so run this feature first or start a new instance.
- Each trust switch is disabled while its own request is pending. Click it again only after it settles.
- `Escape` on the Settings page leaves Settings (goes back).
