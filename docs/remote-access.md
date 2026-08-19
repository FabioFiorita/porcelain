# Remote access

Porcelain's UI is a client of a daemon. This guide covers running the daemon on another machine
and pairing a browser, Mac, or mobile client. Host administration remains on the host.

## Start locally on the host

Node 22+, Git, and a C toolchain for the first `node-pty` build are required:

```sh
npx porcelain-daemon@latest serve
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

`--tailnet` and `--cloudflare` are mutually exclusive. LAN can be combined with either. The
daemon does not bind `0.0.0.0`; LAN and tailnet use specific private interfaces, and Cloudflare
proxies to the loopback listener. Every request still requires a credential.

For a named Cloudflare tunnel, set the token in the environment rather than a command-line flag:

```sh
export PORCELAIN_CLOUDFLARE_TOKEN='<tunnel token>'
npx porcelain-daemon@latest serve --lan --cloudflare --cloudflare-hostname review.example.com
```

Without a token, `--cloudflare` creates a quick `trycloudflare.com` URL that changes on restart.

## Browser origins

When a Hub served from another origin connects to this daemon, allow that exact origin:

```sh
npx porcelain-daemon@latest serve --tailnet --allowed-origin http://hub-host:43118
```

Repeat the flag for additional trusted Hubs. `PORCELAIN_ALLOWED_ORIGIN` (or the accepted plural
`PORCELAIN_ALLOWED_ORIGINS`) is the service-file equivalent. Values are bare `http://` or `https://`
origins with no paths, credentials, wildcard, or `null`. Pairing credentials remain required.

## Pair and revoke devices

On the host:

```sh
npx porcelain-daemon@latest access issue --name "My phone"
npx porcelain-daemon@latest access list
npx porcelain-daemon@latest access revoke <id>
```

Open the issued link on the device. It is single-use, expires after 15 minutes, and becomes an
individually revocable credential. The administrator token is never part of pairing. A browser tab
is connected to the daemon that served it; use another pairing link for another environment.

## Keep it running

For an always-on Linux host, install the daemon as a user-level systemd unit and enable linger;
both are required for survival across logout and reboot. The remote skill contains the unit-file,
Node shim, readiness-polling, and node-pty troubleshooting details.

## Update the daemon

A client shows an "Update daemon" prompt when the daemon it is bound to reports an older
release than the client itself. The unit in the remote skill starts the daemon through
`npx --yes --prefer-online porcelain-daemon@latest`, so restarting the service resolves the
new version and is the whole upgrade:

```sh
systemctl --user restart porcelain-daemon.service
```

A daemon started by hand in a shell is updated by stopping it and re-running
`npx porcelain-daemon@latest serve` with the same flags. Either way the restart is not
instant — poll readiness rather than assuming the daemon is back.

When something is wrong, start with:

```sh
npx porcelain-daemon@latest share status
```

It reports LAN, Tailscale, and Cloudflare status through loopback. Keep host credentials out of
logs, screenshots, URLs, and agent prompts. Revoke a device instead of sharing the administrator
token.
