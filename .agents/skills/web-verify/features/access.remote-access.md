---
route: /settings/$section
shell: desktop
selectors:
  - "Toggle Sidebar"
  - "Settings"
  - "Ways in"
  - "Local network"
  - "Local network warning"
  - "Not encrypted"
  - "Tailscale"
  - "Tailscale name"
  - "Save name"
  - "Copy the tailscale serve command"
  - "Cloudflare tunnel"
  - "Public hostname"
  - "Save hostname"
  - "Check again"
tests:
  - apps/web/spec/e2e/access-remote-access.desktop.e2e.ts
api:
  - GET /api/remote-access
  - PATCH /api/remote-access
---

# access.remote-access

## What it is

Settings → Ways in turns the local network, the tailnet and a Cloudflare tunnel on and off. Each way in shows that it is starting, then the address it serves, or why it failed. The tailnet serves HTTPS at the Tailscale name the owner saves, with the one `tailscale serve` command to run. The local network warns that it is not encrypted and names the one network it listens on. The tunnel turns on once its public hostname is saved.

## How a user reaches it

- Workspace → `Toggle Sidebar` (phone width) → `Settings` (navigator footer) → `Ways in`.
- Keyboard: `Alt+Shift+S` on the workspace (focus outside a text field) opens Settings, then `Ways in`.
- Route: `/settings/ways-in` (desktop shell only).
- Controls: switches "Local network", "Tailscale", "Cloudflare tunnel"; textbox "Tailscale name" + `Save name`; textbox "Public hostname" + `Save hostname`; `Check again` after a failure.

## Driving it

Start with `$C start --desktop`; pair your browser using the card’s pairing-link command, then run from the repository root with `C=.agents/skills/web-verify/scripts/cli`.

### Setup

None. The disposable server fakes the network (`apps/server/spec/kit/sandboxed-server.ts`):
- `eth0` at `192.168.1.20/24` with a known router.
- The tailnet's local listener on port `41000`.
- A tunnel probe that answers for any hostname, except one with an `invalid` label (nothing answers) or one ending `.test` (another server answers).

1. Navigate to `/settings/ways-in` on the card’s web URL (full page load)
   Look for:
   - heading "Ways in"; switch "Local network" not checked.
   - note "Local network warning" reading "Not encrypted" and "Anyone on the same network can read what Porcelain shows and the device credentials it sends. For an encrypted connection, use Tailscale."
   - the text "Turning it on listens on 192.168.1.0/24 on eth0 only, and pauses on any other network."
   - switches "Tailscale" and "Cloudflare tunnel" disabled.
2. Click switch named `Local network`
   Look for:
   - switch "Local network" checked; badge "On".
   - the text `http://192.168.1.20:<port>` with a button "Copy http://192.168.1.20:<port>".
   - the text "Listening on 192.168.1.0/24 on eth0 only."
   - switch "Tailscale" still disabled.
3. Replace the contents of textbox named `Tailscale name` with 'Porcelain.Tail0000.ts.net'
   Look for: button "Save name" enabled.
4. Click button named `Save name`
   Look for:
   - switch "Tailscale" checked.
   - the text "https://porcelain.tail0000.ts.net".
   - the command text "tailscale serve --bg --https=443 http://127.0.0.1:41000" with a button "Copy the tailscale serve command".
5. Replace the contents of textbox named `Public hostname` with 'https://Porcelain.Example.com/'
   Look for: button "Save hostname" enabled; switch "Cloudflare tunnel" still disabled.
6. Click button named `Save hostname`
   Look for: switch "Cloudflare tunnel" checked; the text "https://porcelain.example.com".
7. Replace the contents of textbox named `Public hostname` with 'porcelain.invalid'
   Look for: button "Save hostname" enabled.
8. Click button named `Save hostname`
   Look for: badge "Failed"; the text "Nothing answered at this hostname. Check that cloudflared is running and routes it here."; button "Check again".
9. Replace the contents of textbox named `Public hostname` with 'porcelain.example.com'
   Look for: button "Save hostname" enabled.
10. Click button named `Save hostname`
    Look for: badge "On" and the text "https://porcelain.example.com" again; no button "Check again".
11. Click switch named `Local network`
    Look for: switch "Local network" not checked; no text `http://192.168.1.20:<port>`; the "Turning it on listens on 192.168.1.0/24 …" note again.
12. Navigate to `/settings/ways-in` on the card’s web URL (full page load)
    Look for: after the reload, "Local network" not checked, "Tailscale" and "Cloudflare tunnel" checked, textbox "Tailscale name" holding "porcelain.tail0000.ts.net".

## What proves it works

- Step 12's reload reads `GET /api/remote-access` back: the server kept each switch and hostname. Inspect HTTP requests and responses lists `PATCH /api/remote-access` with status 200 for every switch and Save.
- `apps/web/spec/e2e/access-remote-access.desktop.e2e.ts` covers steps 1–6 and 11:
  - the unchecked switch, the warning text and the "Turning it on listens on …" note;
  - after turning on, the `192.168.1.20` address, "Listening on …", and server state `lan: { enabled: true, status: on }` with `lanNetwork` `eth0` / `192.168.1.0/24`;
  - Tailscale disabled until a name is saved, then on at `https://porcelain.tail0000.ts.net` with the serve command;
  - the tunnel disabled until a hostname is saved, then on at `https://porcelain.example.com`;
  - after turning Local network off, the server state `lan: { enabled: false, status: off }`.
- Steps 7–10 (failure text and recovery) have no test. It follows `routeFailure` in `packages/client/src/features/access/rules/share.ts`.

## Gotchas

- Desktop shell only: without `--desktop`, Settings has no Ways in section. The desktop bridge is not needed.
- Statuses settle asynchronously. Right after a click, a route may show the badge "Starting", "Checking the Tailscale name" or "Checking the tunnel". The page polls every 1 s (`REMOTE_ACCESS_SETTLING_POLL_MS`) while any route settles. Run Inspect the accessibility tree again until the badge reads "On" or "Failed".
- All controls on the page are disabled while a change is in flight.
- The first Save of a hostname also turns its switch on. A later Save only changes the hostname and checks it again.
- Tailscale names must end in `.ts.net`, and hostnames must be `https` with no port or path. Anything else shows a red error from the server, not "Failed".
- The ways in stay as set for the life of the instance and change what `access.share` and `access.device-trust` see: with several ways on, Devices shows an "Opens through" select. Turn them off or start a new instance.
