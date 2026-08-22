# Always-on: systemd + linger

A foreground `npx @fabiofiorita/porcelain@latest serve` dies with the SSH session that started it. For a
host that should keep serving after you log out or reboot, run it as a **user-level systemd unit**
with **linger** enabled. Both parts are required — the unit alone still stops at logout.

## The unit

`~/.config/systemd/user/porcelain.service`:

```ini
[Unit]
Description=Porcelain daemon
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=%h
Environment=PATH=<node-manager-bin>:/usr/local/bin:/usr/bin:/bin
Environment=PORCELAIN_USER_DATA=%h/.local/share/porcelain
Environment=PORCELAIN_DAEMON_PORT=43117
Environment=PORCELAIN_ALLOWED_ORIGIN=http://hub-host:43118
EnvironmentFile=-%h/.porcelain/cloudflare.env
ExecStart=<node-manager-bin>/npx --yes --prefer-online @fabiofiorita/porcelain@latest serve --no-watchdog --lan --cloudflare --cloudflare-hostname review.example.com
Restart=on-failure
RestartSec=5
KillMode=control-group
TimeoutStopSec=15
UMask=0077
NoNewPrivileges=true

[Install]
WantedBy=default.target
```

`~/.porcelain/cloudflare.env` (mode 0600) holds only `PORCELAIN_CLOUDFLARE_TOKEN=...`. The public
hostname is a flag because it is not a secret. Swap `--cloudflare` for `--tailnet` if this host
should stay on a tailnet instead. Do not pass both. Match the exposure you picked in
[serve.md](serve.md). Swap `<node-manager-bin>` for the real bin directory of whatever installed
Node on this host (a Volta shim dir, `~/.local/share/fnm`, a system path — whatever `which node`
resolves through outside systemd). Never leave `<node-manager-bin>` as a literal placeholder in the
file — resolve it for this host before writing the unit.

If a browser Hub on another origin connects through **Settings → Remotes**, set
`PORCELAIN_ALLOWED_ORIGIN` to that Hub's bare `http(s)` origin (scheme, host, and optional port;
no path). Separate multiple trusted Hubs with commas, or use the equivalent
`PORCELAIN_ALLOWED_ORIGINS` variable. The value is an allowlist, never a wildcard; pairing and
client-token authentication remain required.

Notes on the choices that matter here:

- **`--no-watchdog` is required.** The daemon's stdin parent-death watchdog assumes a live
  controlling process; under systemd's process model it just fights service supervision and the unit
  flaps. Systemd's own supervision replaces it.
- **`Restart=on-failure`.** Unexpected crashes restart the service, while an intentional clean
  stop remains stopped.
- **PATH must include the agent CLIs**, not just Node. The daemon discovers `claude`/`codex`/other
  agent CLIs by walking `PATH` when it spawns a terminal — if the unit's `PATH` only has Node, a
  terminal spawned by a remote client won't find those binaries even though an interactive shell
  on the same host would. Include whatever directories your interactive shell's `PATH` has for
  agent CLIs.
- **`UMask=0077` + `NoNewPrivileges=true`** keep the admin-token file and anything the daemon
  writes from being group/world-readable, and block privilege escalation via the service.
- **`@latest`** re-resolves on every restart (including automatic failure restarts),
  so the daemon auto-updates. That's a deliberate tradeoff: you get fixes without manual upkeep,
  but a breaking npm release also lands automatically. Pin a version
  (`@fabiofiorita/porcelain@0.50.0`) in `ExecStart` instead if you'd rather control upgrades by hand.

### The Volta/fnm/nvm trap

If your node manager shims `node`/`npx` (Volta is the common one), pointing `ExecStart` at the
shim instead of the real binary directory breaks under systemd: the shim sets
`_VOLTA_TOOL_RECURSION` (or equivalent) expecting a live parent shell environment that isn't
there, and the process fails with something like "Node is not available" or a bare `ENOENT` — with
no obvious link back to the shim. Two fixes, either works:

1. Point `ExecStart` at the manager's **real** bin directory (not `~/.volta/bin`, the *installed
   toolchain's* bin, e.g. `~/.volta/tools/image/node/<version>/bin/npx`), or
2. Put that real bin directory first in the unit's `PATH` Environment line, as shown above.

## Enable the unit **and** linger

```sh
systemctl --user daemon-reload
systemctl --user enable --now porcelain.service
loginctl enable-linger $USER
```

Both are required:

- `systemctl --user enable` starts the unit on next login and lets `Restart=on-failure` supervise it.
- `loginctl enable-linger $USER` keeps this user's systemd **instance** running (and therefore the
  unit) after the last SSH session to this user closes. Without linger, the unit dies the moment
  you log out even though it's "enabled" — this is the part people skip and then can't figure out
  why the daemon vanished after closing their terminal.

Verify linger stuck:

```sh
loginctl show-user $USER --property=Linger
```

## Check status and logs

```sh
systemctl --user status porcelain.service
journalctl --user -u porcelain.service -f
```

## Readiness after a restart

`npx --yes` re-resolving `@latest` plus `node-pty` already being compiled takes a few seconds — a
restart is not instant. Poll instead of assuming the daemon is up immediately after
`systemctl --user restart`:

```sh
for i in $(seq 1 10); do
  curl -sf http://127.0.0.1:43117/ >/dev/null && break
  sleep 1
done
```

(Swap the port if you set `PORCELAIN_DAEMON_PORT` to something other than 43117.) A script or
agent that immediately calls `access issue` or `share status` right after a restart should use the
same loop — the first second or two will otherwise fail with a connection refused, not a
meaningful error.
