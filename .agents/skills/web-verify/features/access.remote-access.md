---
route: /
shell: desktop
selectors:
  - "Toggle Sidebar"
  - "Settings"
  - "Ways in"
  - "Local network"
  - "Local network warning"
  - "Tailscale"
  - "Tailscale name"
  - "Save name"
  - "Cloudflare tunnel"
  - "Public hostname"
  - "Save hostname"
tests:
  - apps/web/spec/e2e/access-remote-access.desktop.e2e.ts
api:
  - GET /api/remote-access
  - PATCH /api/remote-access
---

# access.remote-access

## What it is

Settings → Ways in turns the local network, the tailnet and a Cloudflare tunnel on and off, shows each starting and then the addresses it serves, the tailnet at the HTTPS Tailscale name the owner saves together with the one tailscale serve command to run, or why it failed, warns that the local network is not encrypted and names the one network it listens on, and turns the tunnel on once its public hostname is saved.

## How a user reaches it

- sidebar → Settings → Ways in → Local network, Tailscale, Cloudflare tunnel
- Shortcut: `Alt+Shift+S`

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start --desktop`.

### Turning the ways in on and off from Settings shows each one starting, then serving its address, the tailnet over HTTPS at the Tailscale name the owner saves with the one tailscale serve command to run, and the local network warns it is not encrypted and names its one network

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Settings"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Ways in"`
   Look for: the switch “Local network” is checked; the note “Local network warning” reads 'Not encryptedAnyone on the same network can read what Porcelain shows and the device credentials it sends. For an encrypted connection, use Tailscale.',; the main “Settings” shows.
4. `.agents/skills/web-verify/scripts/cli click --role switch --name "Local network"`
   Look for: the switch “Local network” is checked; the text “/^http:\/\/192\.168\.1\.20:\d+$/” shows; the text “Listening on 192.168.1.0/24 on eth0 only.” shows; the switch “Tailscale” is disabled.
5. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Tailscale name" "Porcelain.Tail0000.ts.net"`
   Look for: the page settles; take a snapshot to read what it shows.
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Save name"`
   Look for: the switch “Tailscale” is checked; the text “https://porcelain.tail0000.ts.net” shows; the main “Settings” shows; the switch “Cloudflare tunnel” is disabled.
7. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Public hostname" "https://Porcelain.Example.com/"`
   Look for: the page settles; take a snapshot to read what it shows.
8. `.agents/skills/web-verify/scripts/cli click --role button --name "Save hostname"`
   Look for: the switch “Cloudflare tunnel” is checked; the text “https://porcelain.example.com” shows.
9. `.agents/skills/web-verify/scripts/cli click --role switch --name "Local network"`
   Look for: the switch “Local network” is checked; the text “/^http:\/\/192\.168\.1\.20:\d+$/” is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/access-remote-access.desktop.e2e.ts` (Playwright e2e): turning the ways in on and off from Settings shows each one starting, then serving its address, the tailnet over HTTPS at the Tailscale name the owner saves with the one tailscale serve command to run, and the local network warns it is not encrypted and names its one network.
- The tests read back what the server kept through the kit: `server.remoteAccess()`.

## Gotchas

- Only the desktop app shows this; start the instance with `.agents/skills/web-verify/scripts/cli start --desktop`, which serves the web in the desktop Vite mode.
