# Serve: install, quick start, bind modes

## Requirements

- **Node ≥ 22**
- **git** on `PATH`
- A **C toolchain** (make, g++, python3) — the first install compiles `node-pty` for this host

## Quick start

On the remote host:

```sh
npx porcelain-daemon@latest serve
```

Bare `serve` (or no subcommand at all — `porcelain-daemon` alone means `serve`) does three things
and nothing more:

1. Mints `~/.porcelain/admin-token` (0600) if it doesn't exist yet.
2. Starts listening on **port 43117** on `127.0.0.1` only.
3. Prints status lines to stderr: user-data path, port, active binds, admin-token path, and the
   pairing hint.

Nothing outside this host can reach it yet — `127.0.0.1` never leaves the box. Add a bind flag to
change that.

Use `@latest` deliberately: each `npx` invocation re-resolves the newest published version, so
restarting the process (or the systemd unit — see [always-on.md](always-on.md)) picks up updates
automatically. Pin a version (`porcelain-daemon@0.50.0`) only if you want to freeze it.

## Bind modes

All of these **add** a listener; the loopback bind in step 2 above is always present and never
goes away.

| Flag | Adds a listener on | Reaches | When |
|------|--------------------|---------|------|
| *(none)* | `127.0.0.1` only | This host only (e.g. paired with a local Mac app pointed at this daemon over SSH tunnel) | Testing, or the daemon and its only client share a machine |
| `--lan` | This host's RFC1918 addresses (`10/8`, `172.16/12`, `192.168/16`) | Same physical/Wi-Fi network | Home network, same room/office as the other devices |
| `--tailnet` | The detected Tailscale interface address (`100.64/10`) | Any device on your tailnet, anywhere | The common case — your own devices, wherever they are |
| `--funnel` | Nothing new directly — proxies the loopback listener over public Tailscale HTTPS | The public internet | Sharing with someone outside your tailnet, or a device that can't run Tailscale |

Flags combine: `serve --tailnet --funnel` runs both a private tailnet listener and a public HTTPS
proxy at once.

```sh
npx porcelain-daemon@latest serve --tailnet
npx porcelain-daemon@latest serve --lan
npx porcelain-daemon@latest serve --tailnet --funnel
npx porcelain-daemon@latest serve --port 43118 --lan
npx porcelain-daemon@latest serve --tailnet --allowed-origin http://hub-host:43118
```

### Cross-origin browser Hubs

The browser Remotes client needs the daemon to trust the origin of the Hub serving the page. Use
the Hub origin shown in that browser's address bar (scheme + host + port, with no path):

```sh
npx porcelain-daemon@latest serve --tailnet --allowed-origin http://hub-host:43118
```

The flag is repeatable for multiple Hubs. For a supervised deployment, use
`Environment=PORCELAIN_ALLOWED_ORIGIN=http://hub-host:43118` in the unit; comma-separated values
are supported, as is `PORCELAIN_ALLOWED_ORIGINS`. Origins are validated as strict HTTP(S) origins;
paths, credentials, `*`, and `null` are rejected. This only controls the browser CORS courtesy
headers — every tRPC request and WebSocket still requires its paired client token.

### Never `0.0.0.0`

The daemon deliberately never binds the wildcard address. `--lan`/`--tailnet` enumerate specific
private interfaces and explicitly deny virtual/container/VPN interface names (Docker bridges,
`veth`, `tun`, `wg`, …) so opting in to LAN access can't accidentally hand a shell to every
container on a bridge. Range checks alone weren't trusted for this — see `docs/remote-setup.md`
and the Remote owner/proof entries in `docs/internals/agent-foundations.md` in the main repo for
the full reasoning.

### Cleartext-on-LAN tradeoff

Every request still needs a bearer credential, but on a plain home LAN (unlike the
WireGuard-encrypted tailnet) that credential crosses the wire in cleartext — a sniffer on the same
network segment can capture it. This is why `--lan` is opt-in and default-off rather than the
default reach. Prefer `--tailnet` when you can.

### Funnel

`--funnel` requires:

- Tailscale installed and logged in on this host
- Funnel enabled for the tailnet (one-time `tailscale funnel` setup / ACL grant — see Tailscale's
  own docs; this skill doesn't manage tailnet-level ACLs)

It publishes the **loopback** listener at a URL of the form:

```
https://<host>.<tailnet>.ts.net
```

— an HTTPS proxy in front of `127.0.0.1`, not a second daemon process. The daemon refuses to
adopt, replace, or silently widen a Funnel configuration it doesn't already own; if `tailscale
funnel` shows something else running on this target, `--funnel` will not steal it.

Once Funnel is on, pair remote (off-tailnet) devices with `--base-url` pointed at the Funnel URL
— see [pairing.md](pairing.md).

## Options reference

```text
--port <n>           Listen port for loopback AND LAN/tailnet (default 43117)
--user-data <path>   Config dir (default ~/.local/share/porcelain)
--tailnet            Also bind the Tailscale interface (same --port)
--lan                Also bind RFC1918 LAN addresses (same --port)
  --funnel             Publish loopback over public Tailscale Funnel HTTPS
  --allowed-origin <origin>
                       Trust a browser Hub origin (repeat for more than one)
  --no-watchdog        Disable stdin parent-death watchdog (required under systemd)
```

Env equivalents (flags set these when passed; set directly for systemd units or shells):
`PORCELAIN_USER_DATA`, `PORCELAIN_DAEMON_PORT`, `PORCELAIN_ADMIN_TOKEN`,
`PORCELAIN_ALLOWED_ORIGIN` (comma-separated), `PORCELAIN_ALLOWED_ORIGINS` (comma-separated),
`PORCELAIN_TAILNET_BIND`, `PORCELAIN_LAN_BIND`, `PORCELAIN_FUNNEL_BIND`,
`PORCELAIN_NO_STDIN_WATCHDOG`.

A foreground run (no `--no-watchdog`) is fine for "start it when I sit down, stop it when I'm
done" — leave it in a Termius/tmux/SSH session, Ctrl+C stops it. For a host that should survive
logout and reboots, go straight to [always-on.md](always-on.md) instead of running it by hand
every session.
