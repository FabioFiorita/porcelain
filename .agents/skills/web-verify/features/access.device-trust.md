---
route: /settings/$section
shell: desktop
selectors:
  - 'Toggle Sidebar'
  - 'Settings'
  - 'Ways in'
  - 'Local network'
  - 'Open This computer:'
  - 'Paired devices and links'
  - 'can update Porcelain'
  - 'Device name'
  - 'The paired device can update Porcelain'
  - 'Create pairing link'
  - 'Pairing link'
  - 'Pending link'
  - 'This browser'
tests:
  - apps/web/spec/e2e/access-device-trust.desktop.e2e.ts
api:
  - GET /api/access
  - POST /api/access/revoke
  - POST /api/access/trust
  - POST /api/pairings
---

# access.device-trust

On Settings → Computers → This computer → Pair a device the owner lets a paired device update Porcelain and takes that back with the device's "can update Porcelain" switch, and can create a pairing link whose device may update Porcelain from the moment it pairs.

## How to get to it (user POV)

- Workspace → `Toggle Sidebar` (phone width) → `Settings` (navigator footer) → `Computers` → `Open This computer: <name>` → the switch "<device> can update Porcelain" in the device's row.
- Keyboard: `Alt+Shift+S` on the workspace (focus outside a text field) opens Settings, then `Computers` → `Open This computer: <name>`.
- Route: `/settings/devices` (both shells; administration is host-gated).
- For a new device: `Computers` → `Open This computer: <name>` → Ways in → turn on a way in → `Computers` → `Open This computer: <name>` → "Device name" → switch "The paired device can update Porcelain" → `Create pairing link`.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Required instance mode: `--desktop`.

### Setup

None on disk. The default server has two paired devices: "Development setup" (the server kit's own) and "Verification browser" (this browser). Neither can update Porcelain yet.

1. Navigate to `/settings/computers/this-computer#ways-in`
   Expect: title "Settings"; breadcrumb "This computer" and legend "Ways in"; switch "Local network" not checked.
2. Click switch named `Local network`
   Expect: switch "Local network" checked and the text `http://192.168.1.20:<port>` (the server's fake LAN address). A badge "Starting" may show first; inspect the accessibility tree again after a second.
3. Stay on This computer and scroll to Pair a device
   Expect: URL ends `/settings/computers/this-computer`; list "Paired devices and links" with listitems "Development setup" and "Verification browser"; switch "Development setup can update Porcelain" not checked.
4. Click switch named `Development setup can update Porcelain`
   Expect: switch "Development setup can update Porcelain" checked.
5. Navigate to `/settings/devices`
   Expect: after the reload, switch "Development setup can update Porcelain" is still checked (the server kept it).
6. Click switch named `Development setup can update Porcelain`
   Expect: the switch is not checked; Navigate to `/settings/devices` shows it still not checked.
7. Fill textbox `Device name` with 'Release laptop'
   Expect: button "Create pairing link" enabled.
8. Click switch named `The paired device can update Porcelain`
   Expect: switch "The paired device can update Porcelain" checked.
9. Click button `Create pairing link`
   Expect: img "Pairing QR code"; text "Scan on Release laptop"; the Pairing link text `http://192.168.1.20:<port>/pair#c=<one-time code>&e=…`; listitem "Release laptop" containing "Pending link".
10. `$C server pending-links`
    Expect: the link labelled "Release laptop" with `"trusted": true`.

### Observable proof

Reload and read `GET /api/access`: device trust persists. Trust switches POST 200. Confirm `POST /api/pairings` sends `trusted: true` for Release laptop; pending rows do not display trust.

Automated coverage: `access-device-trust.desktop.e2e.ts`.

## Gotchas

- Both shells expose the device controls on This computer, but only host-authorized browsers see administration. Trust switches work without a way in; link creation instead shows “Turn on a way in under Computers → This computer → Ways in to pair a phone or another computer.”
- Run before access.share, which revokes Development setup. Local network/trust changes persist; reset or restart before other maps. Wait for each switch request before toggling again.
