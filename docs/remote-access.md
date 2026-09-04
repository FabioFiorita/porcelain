# Remote access

Porcelain's UI is a client of a daemon. This guide covers running the daemon on another machine
and pairing a browser, desktop, or mobile client. Host administration remains on the host.
Use [the host CLI](../scripts/porcelain-host.js) and its `--help` for current commands;
[remote features](../apps/daemon/src/features/remote/) own implementation and tests.

On Windows, a local WSL 2 distribution is a separate Linux Environment rather than a remote-host
deployment. Once Node 22+, npm/npx, Git, and a C toolchain are installed in the distribution, use
Settings → Environments → **Set up WSL Environment**. The Windows app installs and manages the matching
daemon runtime. The manual service instructions below are for independent remote hosts.

## Start locally on the host

Node 22+, Git, and a C toolchain for the first `node-pty` build are required:

```sh
npx @fabiofiorita/porcelain@latest serve
```

Without an exposure flag this listens on loopback. The first run creates
`~/.porcelain/admin-token` with mode `0600`; it is a host administrator credential and is never
shared with a device.

## Choose exposure

| Mode | Reach | Typical use |
| --- | --- | --- |
| `--lan` | private network interfaces | same home or office network |
| `--tailnet` | Tailscale network | trusted personal devices anywhere |
| `--cloudflare` | HTTPS through Cloudflare | named hostname or one-off public tunnel |

`--tailnet` and `--cloudflare` are mutually exclusive. LAN can be combined with either.
Devices still need pairing. These routes do not expose MCP; the agent plugin connects locally.

For a named Cloudflare tunnel, set the token in the environment rather than a command-line flag:

```sh
export PORCELAIN_CLOUDFLARE_TOKEN='<tunnel token>'
npx @fabiofiorita/porcelain@latest serve --lan --cloudflare --cloudflare-hostname review.example.com
```

Without a token, `--cloudflare` creates a quick `trycloudflare.com` URL that changes on restart.

If `cloudflared` is already managed outside Porcelain (for example as a Windows service), use
Settings → Share → **Custom Cloudflare hostname**. Enter the public HTTPS hostname after adding a
Cloudflare Published application route whose service URL is the LAN URL shown beside the field.
Porcelain stores only the public hostname, never the tunnel token, and uses it when creating the
same one-time HTTP(S) pairing link and QR code as its other share routes. Keep Local network enabled
while this mode uses that LAN service URL. Removing the hostname stops advertising that route in
new pairing links; it does not stop the external `cloudflared` service.

In the mobile app, open Settings → Environments → Create environment group and choose **Scan QR
code**. The scanner accepts both an individual LAN, Tailscale, or Cloudflare pairing link and the
combined Windows + WSL link. Scan it, then confirm pairing.

## Browser origins

When a Hub served from another origin connects to this daemon, allow that exact origin:

```sh
npx @fabiofiorita/porcelain@latest serve --tailnet --allowed-origin http://hub-host:43118
```

Repeat the flag for additional trusted Hubs. `PORCELAIN_ALLOWED_ORIGIN` (or the accepted plural
`PORCELAIN_ALLOWED_ORIGINS`) is the service-file equivalent. Values are bare `http://` or `https://`
origins with no paths, credentials, wildcard, or `null`. Pairing credentials remain required.

## Pair and revoke devices

On the host:

```sh
npx @fabiofiorita/porcelain@latest access issue --name "My phone"
npx @fabiofiorita/porcelain@latest access list
npx @fabiofiorita/porcelain@latest access revoke <id>
```

Open the issued link on the device, paste it into another Porcelain desktop, or scan its QR code
from the Share page. It is single-use, expires after 15 minutes, and becomes an
individually revocable credential. On Windows, the Share page can create a **Windows + WSL link**
to pair those Environments together. Revoke access on each daemon independently.

## Keep it running

In the installed desktop app, closing the last window keeps Porcelain running in the Windows or
Linux system tray while LAN, Tailnet, managed Cloudflare, or a custom Cloudflare route is enabled.
This preserves access from paired devices. Use **Quit Porcelain** from the tray when you intend to
take the host offline. With sharing disabled, closing the last window quits normally. macOS keeps
the app active after its last window closes as usual; use **Quit Porcelain** to stop it.

For an always-on Linux host, install the daemon as a user-level systemd unit and enable linger;
both are required for survival across logout and reboot. Resolve the real `npx` path first; systemd
does not load an interactive shell, and a Node-manager shim may not work outside one.

```sh
command -v npx
mkdir -p ~/.config/systemd/user
```

Create `~/.config/systemd/user/porcelain.service`, replacing `/absolute/path/to/npx` and the
exposure flags for this host:

```ini
[Unit]
Description=Porcelain daemon
After=network-online.target
Wants=network-online.target

[Service]
Environment=PORCELAIN_USER_DATA=%h/.local/share/porcelain
ExecStart=/absolute/path/to/npx --yes --prefer-online @fabiofiorita/porcelain@latest serve --no-watchdog --lan --tailnet
Restart=on-failure
RestartSec=5
KillMode=control-group
UMask=0077
NoNewPrivileges=true

[Install]
WantedBy=default.target
```

For Cloudflare, use `--cloudflare --cloudflare-hostname <host>` instead of `--tailnet` and load
`PORCELAIN_CLOUDFLARE_TOKEN` from a mode-`0600` environment file. Do not put the token in
`ExecStart`. Then enable the service and the user's systemd instance across logout:

```sh
systemctl --user daemon-reload
systemctl --user enable --now porcelain.service
loginctl enable-linger "$USER"
systemctl --user status porcelain.service
```

If the service can start Node but its terminals cannot find agent CLIs, add their real binary
directories to the unit's `PATH`. Do not copy an interactive shell's secrets into the service.

## Update the daemon

A browser Settings → Updates page can check the published package and, when this process is the
always-on unit, restart it. The unit above starts the daemon through
`npx --yes --prefer-online @fabiofiorita/porcelain@latest`, so restarting the service resolves the
new version and is the whole upgrade.

A client also shows an "Update daemon" prompt when the daemon it is bound to reports an older
release than the client itself. Development daemons and a foreground `npx … serve` refuse a
restart from the client — stop them and re-run the serve command with the same flags.

```sh
systemctl --user restart porcelain.service
```

Either way the restart is not instant — poll readiness rather than assuming the daemon is back.

When something is wrong, start with:

```sh
npx @fabiofiorita/porcelain@latest share status
```

It reports LAN, Tailscale, and Cloudflare status through loopback. Keep host credentials out of
logs, screenshots, URLs, and agent prompts. Revoke a device instead of sharing the administrator
token.
