---
route: /settings/$section
shell: desktop
selectors:
  - 'Toggle Sidebar'
  - 'Settings'
  - 'Ways in'
  - 'Local network'
  - 'Local network warning'
  - 'Not encrypted'
  - 'Tailscale'
  - 'Tailscale name'
  - 'Save name'
  - 'Copy the tailscale serve command'
  - 'Cloudflare tunnel'
  - 'Public hostname'
  - 'Save hostname'
  - 'Check again'
tests:
  - apps/web/spec/integration/access-remote-access.test.tsx
api:
  - GET /api/remote-access
  - PATCH /api/remote-access
---

# access.remote-access

Settings → Computers → This computer → Ways in turns the local network, the tailnet and a Cloudflare tunnel on and off.

## How to get to it (user POV)

- Workspace → `Toggle Sidebar` (phone width) → `Settings` (navigator footer) → `Computers` → `Open This computer: <name>` → Ways in.
- Keyboard: `Alt+Shift+S` on the workspace (focus outside a text field) opens Settings, then `Computers` → `Open This computer: <name>` → Ways in.
- Route: `/settings/computers/this-computer#ways-in` (host-authorized browser or desktop).
- Controls: switches "Local network", "Tailscale", "Cloudflare tunnel"; textbox "Tailscale name" + `Save name`; textbox "Public hostname" + `Save hostname`; `Check again` after a failure.

## Driving it with browser

Preconditions: [surface baseline](README.md).

Each way in shows that it is starting, then the address it serves, or why it failed. The tailnet serves HTTPS at the Tailscale name the owner saves, with the one `tailscale serve` command to run. The local network warns that it is not encrypted and names the one network it listens on. The tunnel turns on once its public hostname is saved.

Required instance mode: `--desktop`.

 The disposable server fakes the network:

- `eth0` at `192.168.1.20/24` with a known router.
- The tailnet's local listener on port `41000`.
- A tunnel probe that answers for any hostname, except one with an `invalid` label (nothing answers) or one ending `.test` (another server answers).

1. Navigate to `/settings/computers/this-computer#ways-in`
   Expect:
   - breadcrumb "This computer" and legend "Ways in"; switch "Local network" not checked.
   - note "Local network warning" reading "Not encrypted" and "Anyone on the same network can read what Porcelain shows and the device credentials it sends. For an encrypted connection, use Tailscale."
   - the text "Turning it on listens on 192.168.1.0/24 on eth0 only, and pauses on any other network."
   - switches "Tailscale" and "Cloudflare tunnel" disabled.
2. Click switch named `Local network`
   Expect:
   - switch "Local network" checked; badge "On".
   - the text `http://192.168.1.20:<port>` with a button "Copy http://192.168.1.20:<port>".
   - the text "Listening on 192.168.1.0/24 on eth0 only."
   - switch "Tailscale" still disabled.
3. Fill textbox `Tailscale name` with 'Porcelain.Tail0000.ts.net'
   Expect: button "Save name" enabled.
4. Click button `Save name`
   Expect:
   - switch "Tailscale" checked.
   - the text "https://porcelain.tail0000.ts.net".
   - the command text "tailscale serve --bg --https=443 http://127.0.0.1:41000" with a button "Copy the tailscale serve command".
5. Fill textbox `Public hostname` with 'https://Porcelain.Example.com/'
   Expect: button "Save hostname" enabled; switch "Cloudflare tunnel" still disabled.
6. Click button `Save hostname`
   Expect: switch "Cloudflare tunnel" checked; the text "https://porcelain.example.com".
7. Fill textbox `Public hostname` with 'porcelain.invalid'
   Expect: button "Save hostname" enabled.
8. Click button `Save hostname`
   Expect: badge "Failed"; the text "Nothing answered at this hostname. Check that cloudflared is running and routes it here."; button "Check again".
9. Fill textbox `Public hostname` with 'porcelain.example.com'
   Expect: button "Save hostname" enabled.
10. Click button `Save hostname`
    Expect: badge "On" and the text "https://porcelain.example.com" again; no button "Check again".
11. Click switch named `Local network`
    Expect: switch "Local network" not checked; no text `http://192.168.1.20:<port>`; the "Turning it on listens on 192.168.1.0/24 …" note again.
12. Navigate to `/settings/computers/this-computer#ways-in`
    Expect: after the reload, "Local network" not checked, "Tailscale" and "Cloudflare tunnel" checked, textbox "Tailscale name" holding "porcelain.tail0000.ts.net".

### Observable proof

Reload/read `GET /api/remote-access`: switches/hostnames persist; each PATCH answers 200. Drive failure/recovery separately; those branches have no named automated test.

Automated coverage: `access-remote-access.test.tsx`.

## Gotchas

- Requires desktop mode; no native bridge is needed. Wait through Starting, Checking the Tailscale name or Checking the tunnel to On/Failed; controls disable during writes.
- First hostname Save enables its switch; later saves update/recheck. Tailscale ends in `.ts.net`; hostnames require HTTPS without port/path. Invalid syntax shows a server validation error rather than Failed.
- Route settings persist and change Devices’ Opens through choices; reset or restart before other maps.
