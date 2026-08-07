# Troubleshooting

Start every investigation with:

```sh
npx porcelain-daemon@latest share status
```

It prints `lan`, `tailnet`, and `funnel` status in one JSON blob (bound or not, and the URL each
resolves to) and needs only loopback to run — so it works even when the exposure you're trying to
debug is the thing that's broken. Confirm the daemon itself is reachable at all
(`curl http://127.0.0.1:<port>/`) before chasing a network-layer theory.

## Install fails — node-pty won't compile

The first `npm install` (via `npx`) compiles `node-pty` natively for this host. If it fails,
you're missing a C toolchain:

```sh
# Debian/Ubuntu
sudo apt-get install -y build-essential python3

# Fedora
sudo dnf groupinstall -y "Development Tools"
```

Then retry `npx porcelain-daemon@latest serve`. `python3` and `make`/`g++` (or your platform's
equivalent) all need to be on `PATH`.

## Works interactively, fails under systemd ("Node is not available", ENOENT)

Almost always a Volta/fnm/nvm shim in `ExecStart`. See the Volta/fnm/nvm trap section in
[always-on.md](always-on.md) — point `ExecStart` at the real installed Node bin directory (or put
it first in the unit's `PATH`), not the shim.

A close cousin: the unit's terminal spawns can't find `claude`/`codex`/other agent CLIs. Same
fix — the unit's `PATH` Environment line needs the directories those binaries live in, which your
interactive shell has but a systemd unit does not inherit.

## Port already in use

```sh
[porcelain-daemon] port       43117
```
```
Error: listen EADDRINUSE: address already in use 127.0.0.1:43117
```

Another daemon (or something else) already owns that port. Either stop it, or run this one on a
different port with `--port <n>` (and matching `PORCELAIN_DAEMON_PORT` if you're editing a
systemd unit). Two daemons on the same host normally means production (43117) and something else
colliding — don't just bump the port without checking what's already listening
(`ss -ltnp | grep 43117` or equivalent).

## `--tailnet` doesn't bind anything

`findTailscaleAddress` deliberately returns nothing (rather than guessing) when it can't find an
unambiguous Tailscale interface. Check:

```sh
tailscale status
```

If that shows "Logged out" or no interface, log in first (`tailscale up`). If it shows multiple
plausible Tailscale-range addresses, the daemon refuses to pick one — that's usually an unusual
multi-tailnet or VPN-overlap setup worth resolving at the Tailscale layer, not a Porcelain bug.

## `--funnel` doesn't come up / Funnel URL 404s

- Confirm Tailscale is logged in (`tailscale status`).
- Confirm Funnel is enabled for the tailnet — this is a one-time ACL grant in the Tailscale admin
  console (Funnel isn't on by default even when Tailscale itself is). See Tailscale's own docs for
  enabling Funnel; this skill doesn't manage tailnet ACLs.
- If `tailscale funnel status` shows something else already publishing on this daemon's target,
  the daemon refuses to steal it — stop the conflicting Funnel config first, or point Funnel at a
  free target.

## "Unreachable" vs 401 — different problems

- **Connection refused / timeout** → network layer. Wrong bind mode for where the device actually
  is (see the bind-mode table in [serve.md](serve.md)), a firewall, or the daemon isn't running.
  `share status` still answers over loopback even here — SSH in and run it locally to confirm the
  daemon itself is alive before chasing network config.
- **401 Unauthorized** → the daemon is reachable, the credential is the problem. The device's
  paired token was revoked or never got exchanged. Check `access list`; re-pair with
  `access issue` if the device isn't in the `clients` array.

Don't conflate the two — a 401 means the network path already works.

## Pairing link doesn't work

- **"used" / fails silently** — links are single-use; a second open (e.g. the human reloaded the
  page) doesn't work. Issue a new one.
- **"expired"** — 15-minute TTL from `access issue`. Issue immediately before the device will
  actually open it, not ahead of time.
- **Link opens but can't reach the daemon** — the `--base-url` baked into the link doesn't
  actually route to this host from the device's network. Re-issue with an explicit `--base-url`
  matching a bind mode that device can actually reach (e.g. the device is off-tailnet: use the
  Funnel URL, not the tailnet one).

## Lost the admin token / locked out of host administration

The token lives at `~/.porcelain/admin-token` (0600) on the host. If you truly lost host-level
access (not just a device token), you still have filesystem access to the host itself (SSH) — the
token is just a file; there's no separate "reset" flow. Deleting it and restarting `serve` mints a
fresh one, but note this invalidates the old admin token immediately.
