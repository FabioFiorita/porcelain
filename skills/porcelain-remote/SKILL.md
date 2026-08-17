---
name: porcelain-remote
description: Set up a remote Porcelain daemon — install, serve, choose exposure (LAN / Tailscale / Cloudflare), pair devices, keep it always-on with systemd + linger, and run day-2 ops (revoke access, check share status, troubleshoot). Use whenever the human wants to reach Porcelain from a second machine, phone, or iPad; mentions a remote daemon, pairing a device, Tailscale, Cloudflare, or systemd for Porcelain; or asks to make Porcelain "always on."
version: 0.54.0
license: MIT
---

# Porcelain remote

Porcelain's UI is a client of a daemon. Normally that daemon lives on the machine right in front
of you. This skill sets up a daemon on a **different** machine — a home server, a cloud box, a
mini-PC — so any device (Mac app, browser, iPhone, iPad) can reach it.

## Two CLIs — do not confuse them

Porcelain ships **two separate command-line tools**. Mixing them up is the most common setup
mistake.

| | `porcelain-daemon` | `~/.porcelain/porcelain` |
|---|---|---|
| What | The **host CLI** — installs, starts, and administers the daemon itself | The **companion CLI** — an agent talks to a *running* daemon's Project data (Review Canvas, Tasks, Actions, scope) |
| Runs on | The remote host, once, to bring the daemon up | Any machine with a repo, once the daemon is already running |
| Installed via | `npx porcelain-daemon@latest` (npm package) | Auto-installed by the daemon/app on launch — never `npm install` it yourself |
| Covered by | **This skill** | The `porcelain-companion` skill |

If the human wants the Review Canvas (Intent/Process/Execution/Evidence), Tasks, Actions, or scope — that's `porcelain-companion`,
not this skill. This skill is exclusively about getting a daemon **running and reachable**.

## References

```
references/
  serve.md            porcelain-daemon serve, bind modes (LAN / Tailscale / Cloudflare), tradeoffs
  pairing.md           access issue/list/revoke, the pairing-link exchange, security model
  always-on.md         systemd user unit + linger, restart policy, readiness polling
  troubleshooting.md   node-pty/C toolchain, Volta shims, port conflicts, 401 vs unreachable
```

## When → what

| When | Do |
|------|----|
| First-time setup on a fresh host | [references/serve.md](references/serve.md) quick start, then decide LAN vs Tailscale vs Cloudflare |
| "How do I reach it from my phone / another machine?" | Pick a bind mode in [serve.md](references/serve.md); default to `--tailnet` unless the human is on the same LAN or explicitly wants public HTTPS |
| Add a device (phone, second laptop) | [references/pairing.md](references/pairing.md) — `access issue --name "…"` |
| Lost a device / rotate access | [references/pairing.md](references/pairing.md) — `access list` then `access revoke <id>` |
| "Keep this running after I close my laptop / log out" | [references/always-on.md](references/always-on.md) — systemd user unit **and** `loginctl enable-linger` |
| "Is it up? What's exposed?" | `porcelain-daemon share status` first — see [troubleshooting.md](references/troubleshooting.md) |
| Install fails, pairing fails, can't connect | [references/troubleshooting.md](references/troubleshooting.md) |

## The shape of a setup

1. **Install & serve.** `npx porcelain-daemon@latest serve` on the remote host. This alone binds
   loopback only — nothing reachable yet from another machine.
2. **Choose exposure.** Add `--lan` (same network), then either `--tailnet` (your private mesh)
   or `--cloudflare` (public HTTPS in front of loopback). Do not combine Tailscale and Cloudflare.
   Detail and tradeoffs: [references/serve.md](references/serve.md).
3. **Pair each device.** `porcelain-daemon access issue --name "…"` prints a one-time link; open
   it on that device. Detail: [references/pairing.md](references/pairing.md).
4. **Make it durable.** A foreground `npx` process dies with the SSH session. For a host that
   should stay up, install the systemd user unit and enable linger.
   [references/always-on.md](references/always-on.md).
5. **Day 2.** `share status` to check exposure, `access list`/`access revoke` to manage devices,
   [references/troubleshooting.md](references/troubleshooting.md) when something doesn't connect.

## Security model, in one paragraph

The daemon always binds `127.0.0.1`; `--lan`/`--tailnet` add listeners on private interfaces only
— never `0.0.0.0`. Cloudflare is an HTTPS proxy in front of the loopback listener, not a second
daemon. Every request needs a bearer credential: the host administrator token
(`~/.porcelain/admin-token`, mode 0600, never shared with a device) or a per-device token minted
by pairing. Pairing links (`pc_pair_…`) are single-use, expire in 15 minutes, and carry their
secret only in the URL fragment (never sent to a server on GET). Each paired device gets its own
revocable token; `access revoke` also closes that device's live sessions. Full detail:
`docs/remote-setup.md` and the Remote owner/proof entries in
`docs/internals/agent-foundations.md` in the main repo, and
[references/pairing.md](references/pairing.md) here.

## Standing rules

1. **Never print or log the admin token.** It lives at `~/.porcelain/admin-token` (0600) on the
   host and is read by the host CLI itself — you never need to cat it, echo it, or put it in a
   pairing link.
2. **Prefer the narrowest exposure that solves the human's actual reach.** Same house/office →
   `--lan`. Different networks, own devices → `--tailnet`. No Tailscale → `--cloudflare`. Don't
   turn on Cloudflare by default "to be safe."
3. **`--no-watchdog` is required under systemd** (or any process supervisor) — the daemon's stdin
   parent-death watchdog conflicts with supervised restarts. Foreground/manual runs keep the
   watchdog on.
4. **Pair, don't share the admin token.** A device always gets its own token via `access issue` +
   the printed link, never the host administrator credential.
5. **`share status` is the first diagnostic**, before assuming the daemon is down or the network
   is broken.
