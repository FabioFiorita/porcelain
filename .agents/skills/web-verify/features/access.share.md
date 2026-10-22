---
route: /settings/$section
shell: desktop
selectors:
  - 'Toggle Sidebar'
  - 'Settings'
  - 'Open This computer'
  - 'Ways in'
  - 'Local network'
  - 'Device name'
  - 'Create pairing link'
  - 'Pairing QR code'
  - 'Pairing link'
  - 'Copy link'
  - 'Paired devices and links'
  - 'This browser'
  - 'Pending link'
  - 'Cancel the link for'
  - 'Revoke'
tests:
  - apps/web/spec/e2e/access-share.desktop.e2e.ts
api:
  - GET /api/access
  - GET /api/inventory
  - GET /api/remote-access
  - PATCH /api/remote-access
  - POST /api/access/revoke
  - POST /api/pairings
---

# access.share

On the computer that runs Porcelain, Settings → Computers → This computer → Pair a device creates a one-time pairing link and its QR code for the one way in the device will work through.

## How to get to it (user POV)

- Workspace → `Toggle Sidebar` (phone width) → `Settings` (navigator footer) → `Computers` → `Open This computer`.
- Keyboard: `Alt+Shift+S` on the workspace (focus outside a text field) opens Settings, then `Computers` → `Open This computer`.
- Route: `/settings/devices` (host-authorized browser or desktop).
- Controls: textbox "Device name" + `Create pairing link` (or `Enter` in the field); `Copy link`; `Revoke <device>`; `Cancel the link for <device>`.

## Driving it with browser

Preconditions: [surface baseline](README.md).

It lists the paired devices with the way in each is bound to, marks this browser, shows the pending links, and revokes another device or cancels a pending link.

Required instance mode: `--desktop`.

### Setup

None on disk. The default server has two paired devices, both bound to "This computer" (loopback): "Development setup" (the server kit's own) and "Verification browser" (this browser).

1. Navigate to `/settings/devices`
   Expect:
   - breadcrumb "This computer";
   - the text "Turn on a way in under Computers → This computer → Ways in to pair a phone or another computer." (no "Device name" field yet);
   - list "Paired devices and links" with listitems "Development setup" and "Verification browser".
2. Click button `Computers`, then button named `Open This computer`
   Expect: URL ends `/settings/computers/this-computer#ways-in`; switch "Local network" not checked.
3. Click switch named `Local network`
   Expect: switch "Local network" checked and the text `http://192.168.1.20:<port>`. A badge "Starting" may show first; inspect the accessibility tree again after a second.
4. Stay on This computer and scroll to Pair a device
   Expect: textbox "Device name"; the text "The link opens through Local network. The device will work only through the way in it pairs over. To use it through another way in too, pair it again through that one."
5. Fill textbox `Device name` with 'My phone'
   Expect: button "Create pairing link" enabled.
6. Click button `Create pairing link`
   Expect:
   - img "Pairing QR code" and the text "Scan on My phone";
   - the Pairing link text starting `http://192.168.1.20:<port>/pair#c=<one-time code>`; button "Copy link";
   - listitem "My phone" containing "Pending link", with a button "Cancel the link for My phone";
   - listitem "Verification browser" containing "This browser" and "This computer", with no "Revoke Verification browser" button;
   - listitem "Development setup" containing "This computer", with a button "Revoke Development setup".
7. Click button `Revoke Development setup`
   Expect: no listitem "Development setup".
8. Navigate to `/settings/devices`
   Expect: after the reload, still no listitem "Development setup"; listitem "My phone" still "Pending link".
   Proof before continuing: read `GET /api/access` now: revoked Development setup is absent and My phone remains pending. `$C server pending-links` lists My phone; pairing/revoke POSTs answer 200. After step 9, read again and require My phone absent.

9. Click button `Cancel the link for My phone`
   Expect: no listitem "My phone"; the cancelled QR, link, Copy link and expiry disappear, and the Pair a device form can issue another link. Other pending links remain.

Automated coverage: `access-share.desktop.e2e.ts`.

## Gotchas

- Host permission gates administration in both shells. Never revoke this browser; it has no Revoke action. Run access.device-trust before revoking Development setup, or restart afterward.
- Local network remains enabled; multiple ways in add Opens through. Links work once for 15 minutes and show Works once, until <time>.
- The fixture's 192.168.1.20 address has no listener. Keep real pairing codes private.
