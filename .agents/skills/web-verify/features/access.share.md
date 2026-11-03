---
route: /settings/$section
shell: desktop
selectors:
  - 'Toggle Sidebar'
  - 'Settings'
  - 'Open This computer:'
  - 'Ways in'
  - 'Local network'
  - 'Device name'
  - 'Create pairing link'
  - 'Pairing QR code'
  - 'Pairing link'
  - 'Copy link'
  - 'Paired devices and links'
  - 'This device'
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

- Workspace → `Toggle Sidebar` (phone width) → `Settings` (navigator footer) → `Computers` → `Open This computer: <name>`.
- Keyboard: `Alt+Shift+S` on the workspace (focus outside a text field) opens Settings, then `Computers` → `Open This computer: <name>`.
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
2. Click button `Computers`, then button named `Open This computer: <name>`
   Expect: URL ends `/settings/computers/this-computer#ways-in`; switch "Local network" not checked.
3. Click switch named `Local network`
   Expect: switch "Local network" checked and the text `http://192.168.1.20:<port>`. A badge "Starting" may show first; inspect the accessibility tree again after a second.
4. Stay on This computer and scroll to Pair a device
   Expect: textbox "Device name"; the text "The link opens through Local network. The device will work only through the way in it pairs over. To use it through another way in too, pair it again through that one."
   With multiple ways in enabled, Opens through shows the selected way-in name
   and its full address on a separate wrapping line. Open the chooser: every
   option discloses its full address, wrapping as needed. Check at 1440, 1080
   and 414 px in light and dark, including keyboard selection and Escape
   returning focus to the trigger. Changing the selection updates the address
   below the trigger.
5. Fill textbox `Device name` with 'My phone'
   Expect: button "Create pairing link" enabled.
6. Click button `Create pairing link`
   Expect:
   - img "Pairing QR code" and the text "Scan on My phone";
   - the Pairing link text `https://porcelain.fabiofiorita.com/open/pair#c=<one-time code>&e=<environmentId>&a=http%3A%2F%2F192.168.1.20%3A<port>`, the app link the phone Camera opens; button "Copy link";
   - listitem "My phone" containing "Pending link", with a button "Cancel the link for My phone";
   - listitem "Verification browser" containing "This device" and "This computer", with no "Revoke Verification browser" button;
   - listitem "Development setup" containing "This computer", with a button "Revoke Development setup".

   Capture the QR alone at browser zoom 100% and device pixel ratio 1. Decode
   those original pixels and a 0.5 px blurred copy, comparing both results with
   the issued link in memory. Repeat with independently issued links. Retain
   only decoder results and screenshots with the QR and link masked. At 414 px,
   the QR, scan caption and expiry must fit without horizontal overflow.
   With multiple ways in available, change Opens through after issuing a link:
   the existing link's caption must keep the way in that issued it, and the
   link and QR must stay unchanged until another link is created.
   If that way in becomes unavailable, omit the route claim rather than name
   another way in; enabling the original way in restores its caption.

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

## Remote management and new pairing defaults

A device granted **Can manage sharing** may open that computer’s Devices and Pair a device controls remotely. Update permission remains separate. New links created in this form default both permissions on; verify each switch’s current state, and switch it off to opt out. Existing devices and legacy links do not gain management automatically. Old Can edit ways in grants remain narrower. Withdraw management, then verify the next administration request is refused while ordinary read access remains. Revocation still removes only the named device.

Drive real configured LAN/remote transport separately from the loopback sandbox. A remote loopback connection is intentionally refused administration even with a grant. Do not count a fake address, Host rewrite or simulated tunnel as physical network or OS permission proof.

Devices refresh while observed, including pairing or permission changes made on another device. Temporary read failure keeps the draft and confirmed list, disables sharing writes, and recovers without reload. Authentication loss clears prior private data; permission denial removes controls. Leaving the last observed Computers view stops its reads.
