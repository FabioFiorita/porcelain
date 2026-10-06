# access.share

## What it is

On the computer that runs Porcelain, Settings → Devices creates a one-time pairing link and its QR code for the one way in the device will work through. It lists the paired devices with the way in each is bound to, marks this browser, shows the pending links, and revokes another device or cancels a pending link.

## How a user reaches it

- Workspace → `Toggle Sidebar` (phone width) → `Settings` (navigator footer) → `Devices`.
- Keyboard: `Alt+Shift+S` on the workspace (focus outside a text field) opens Settings, then `Devices`.
- Route: `/settings/devices` (desktop shell only).
- Controls: textbox "Device name" + `Create pairing link` (or `Enter` in the field); `Copy link`; `Revoke <device>`; `Cancel the link for <device>`.

## Driving it

Start with `$C start --desktop`, then run from the repository root with `C=.agents/skills/web-verify/scripts/cli`.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

None on disk. The default server has two paired devices, both bound to "This computer" (loopback): "Development setup" (the server kit's own) and "Verification browser" (this browser).

1. Open `/settings/devices` on the instance web URL
   Look for:
   - heading "Devices";
   - the text "Turn on a way in under Ways in to pair a phone or another computer." (no "Device name" field yet);
   - list "Paired devices and links" with listitems "Development setup" and "Verification browser".
2. Click the button named 'Ways in'
   Look for: Page URL ends `/settings/ways-in`; switch "Local network" not checked.
3. Click the switch named 'Local network'
   Look for: switch "Local network" checked and the text `http://192.168.1.20:<port>`. A badge "Starting" may show first; inspect the current page again after a second.
4. Click the button named 'Devices'
   Look for: textbox "Device name"; the text "The link opens through Local network. The device will work only through the way in it pairs over. To use it through another way in too, pair it again through that one."
5. Set the text field named 'Device name' to 'My phone'
   Look for: button "Create pairing link" enabled.
6. Click the button named 'Create pairing link'
   Look for:
   - img "Pairing QR code" and the text "Scan on My phone";
   - the Pairing link uses the nonsecret origin and path `http://192.168.1.20:<port>/pair`; button "Copy link". Keep its code and QR capture private;
   - listitem "My phone" containing "Pending link", with a button "Cancel the link for My phone";
   - listitem "Verification browser" containing "This browser" and "This computer", with no "Revoke Verification browser" button;
   - listitem "Development setup" containing "This computer", with a button "Revoke Development setup".
7. Click the button named 'Revoke Development setup'
   Look for: no listitem "Development setup".
8. Open `/settings/devices` on the instance web URL
   Look for: after the reload, still no listitem "Development setup"; listitem "My phone" still "Pending link".
9. Click the button named 'Cancel the link for My phone'
   Look for: no listitem "My phone".

## What proves it works

- Step 8's reload reads `GET /api/access` back: the server forgot the revoked device and keeps the pending link. Browser network evidence lists `POST /api/pairings` (step 6) and `POST /api/access/revoke` (steps 7 and 9) with status 200.
- `$C server pending-links` after step 6 lists the "My phone" link. Redeeming a link is `access.pairing`.
- `apps/web/spec/e2e/access-share.desktop.e2e.ts`:
  - the "Turn on a way in …" hint, then Local network on and the note that the link opens through Local network and the device works only through the way in it pairs over;
  - the QR code, a link matching `^http://192.168.1.20:\d+/pair#c=pcp_`, and server pending links `['My phone']`;
  - "This browser" and "This computer" on its own row, both devices on route `loopback`, no Revoke button on its own row, and "Pending link" on My phone;
  - after revoking "Development setup", the server lists only its own browser. Its browser is named "Journey browser"; the verification browser’s is "Verification browser".

## Gotchas

- Desktop shell only: without `--desktop`, Settings has no Devices section (the web shell redirects `/settings/devices` to `/settings/appearance`). The desktop bridge is not needed.
- Revoking "Development setup" lasts for the life of the instance, and `access.device-trust` needs that device. Run that feature first or start a new instance. Never revoke this browser: its row has no Revoke button. Pairing it again needs a new instance.
- Local network stays on after step 3. With more than one way in on (for example after `access.remote-access`), an "Opens through" select appears and the note names the chosen way in.
- A link works once, for 15 minutes. Its expiry time shows as "Works once, until <time>".
- `192.168.1.20` is the server's fake LAN address, so nothing listens there, and the launcher’s textual evidence redacts the pairing code.
- `Escape` on the Settings page leaves Settings.
