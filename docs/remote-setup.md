# Setting up a remote daemon

Porcelain's UI is a client of a daemon. Usually that daemon runs on the same machine you're
sitting at. This page walks through running it on a **different** machine instead — a home
server, a mini-PC, a cloud box — so your Mac app, browser, and phone can all point at one place.

If you only want the everyday workflow (Review Canvas, Tasks, and Actions), you don't need this page — see
[product.md](product.md). This is for the one-time setup of the daemon itself.

## Two command-line tools

Porcelain ships two separate CLIs. They do different jobs and neither substitutes for the other.

- **`porcelain-daemon`** — the host CLI. Installs, starts, and administers the daemon: `serve`,
  `access issue/list/revoke`, `share status`. This is what this page is about.
- **`~/.porcelain/porcelain`** — the companion CLI an agent uses to read and write daemon-root
  Review Canvases, Tasks, and Actions once a daemon is already running. Auto-installed on every launch; you never
  `npm install` it yourself.

## Install and start

On the remote host (Node 22+, git, and a C toolchain for the first-time `node-pty` build):

```sh
npx porcelain-daemon@latest serve
```

This binds `127.0.0.1` only — nothing outside the host can reach it yet. It also mints
`~/.porcelain/admin-token` (permissions `0600`) the first time it runs; that file is host
administration and is never shared with a device.

## Choose how it's reachable

Add a flag to open it up, matched to where your other devices actually are:

| Flag | Reaches | Use when |
|------|---------|----------|
| `--lan` | Same physical/Wi-Fi network | You're on the same LAN as the host |
| `--tailnet` | Any device on your Tailscale network | The common case — your own devices, anywhere |
| `--funnel` | The public internet, over HTTPS | Sharing with someone off your tailnet |

```sh
npx porcelain-daemon@latest serve --tailnet
```

The daemon never binds the wildcard address (`0.0.0.0`) under any of these — `--lan`/`--tailnet`
add listeners on specific private interfaces only, and Funnel is an HTTPS proxy in front of the
loopback listener rather than a second daemon. Every request still needs a credential either way.
Full bind-mode tradeoffs (including the cleartext-on-LAN caveat) are in the
`porcelain-remote` agent skill's `references/serve.md`.

## Pair a device

From another terminal on the host:

```sh
npx porcelain-daemon@latest access issue --name "My phone"
```

Open the printed link on that device — a browser for the web client, or paste it into the Mac
app's **Settings → Remotes**. It's a one-time link: single use, expires in 15 minutes, and
becomes an individually revocable credential for just that device. The host administrator token
is never part of this exchange.

Manage devices from the host CLI (or the Mac app's **Settings → Share**):

```sh
npx porcelain-daemon@latest access list
npx porcelain-daemon@latest access revoke <id>
```

## Keep it running

A daemon started this way stops the moment you close the terminal or log out. For a host that
should stay up across reboots and logouts, install it as a **user-level systemd unit** and enable
**linger** — both are required, the unit alone still dies at logout. The full unit file, the
Volta/fnm/nvm shim trap, and a readiness-polling snippet for after a restart live in the
`porcelain-remote` agent skill's `references/always-on.md`.

## Day 2

```sh
npx porcelain-daemon@latest share status
```

is the first thing to run when something seems off — it reports LAN, tailnet, and Funnel status
in one call and only needs loopback, so it works even when the exposure you're debugging is the
thing that's broken.

## Ask an agent to do this for you

All of the above — including the systemd unit, linger, and troubleshooting steps for node-pty
compile failures, Volta shims, and port conflicts — is written up as the `porcelain-remote` agent
skill (installed the same way as the everyday companion skill, via
[skills.sh](https://www.skills.sh)). Point an agent at it and describe what you're trying to
reach, and it'll walk the setup with you.
