# Phase 4 — Beelink bring-up runbook

**Status:** prep code SHIPPED 2026-07-04 (05fe1b8 daemon dist, 30cdfb6 remote-daemon connection); ops steps below wait for the hardware (~mid-July 2026).
Everything here was rehearsed against a `node:22` Linux container in OrbStack on 2026-07-04: `npm install` compiled node-pty, auth/static/repo-open/PTY-over-WS all verified, and the Mac app connected → browsed the Linux disk → opened a repo → ran a remote bash → disconnected cleanly. Arrival day is this checklist, not a debugging session.

## 0. What the Beelink needs installed

- **Tailscale** — `curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up --ssh` (SSH on, per the spec). Note the MagicDNS name (`beelink` below).
- **Node ≥ 22** (nodesource or nvm), **git**, and a **build toolchain** for node-pty (`sudo apt install -y build-essential python3` on Debian/Ubuntu).
- **Claude Code** (`npm i -g @anthropic-ai/claude-code` or the installer) — the whole point of the box.

## 1. Ship the daemon

On the Mac:
```sh
pnpm build && pnpm daemon:dist
tar czf porcelain-daemon.tgz -C dist-daemon .
scp porcelain-daemon.tgz beelink:
```
On the Beelink:
```sh
mkdir -p ~/porcelain-daemon && tar xzf porcelain-daemon.tgz -C ~/porcelain-daemon
cd ~/porcelain-daemon && npm install        # compiles node-pty for the Beelink's ABI
```

## 2. Token — ONE secret across the fleet

Copy the Mac's existing token so every daemon and client already agree:
```sh
ssh beelink 'mkdir -p ~/.porcelain && chmod 700 ~/.porcelain'
scp ~/.porcelain/daemon-token beelink:.porcelain/daemon-token
ssh beelink 'chmod 600 ~/.porcelain/daemon-token'
```
(The daemon reads that file when `PORCELAIN_DAEMON_TOKEN` is unset — never put the token in argv.)

## 3. Run it under systemd

`~/.config/systemd/user/porcelain-daemon.service` (template also in the dist README):
```ini
[Unit]
Description=Porcelain daemon
After=network-online.target
Wants=network-online.target

[Service]
Environment=PORCELAIN_USER_DATA=%h/.local/share/porcelain
Environment=PORCELAIN_DAEMON_PORT=43117
Environment=PORCELAIN_NO_STDIN_WATCHDOG=1
# Optional: force second-listener binds without a GUI toggle
# Environment=PORCELAIN_TAILNET_BIND=1
# Environment=PORCELAIN_LAN_BIND=1
WorkingDirectory=%h/porcelain-daemon
ExecStart=/usr/bin/node main/daemon/server.js
Restart=on-failure

[Install]
WantedBy=default.target
```
`PORCELAIN_NO_STDIN_WATCHDOG=1` is REQUIRED under systemd — stdin is `/dev/null`, which closes immediately and the parent-death watchdog would exit the daemon on boot (verified empirically). Prefer `network-online.target` over `network.target` so DHCP has an address before the first bind; the daemon also re-scans interfaces every 5s while a second listener is enabled, so a residual boot race or later network change still recovers without a restart. Then:
```sh
systemctl --user enable --now porcelain-daemon
loginctl enable-linger $USER      # keep it running without an active session
```

## 4. Open the tailnet listener (once)

The loopback listener is up; flip the persisted tailnet bind from the Beelink itself:
```sh
TOKEN=$(cat ~/.porcelain/daemon-token)
curl -X POST -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d true http://127.0.0.1:43117/trpc/setTailnetBind
```
Expect `{"enabled":true,"url":"http://100.x.y.z:43117"}`. The setting persists across restarts. Never widen the bind beyond loopback + the Tailscale interface (audit invariant).

## 5. Repos + agent channel

```sh
ssh beelink 'mkdir -p ~/Code && cd ~/Code && git clone <your repos>'
```
Claude Code + porcelain MCP plugin on the Beelink: copy `~/.porcelain/plugin` from the Mac (or regenerate via Settings → Agents on any machine), then run the two `claude plugin` commands shown in Settings → Agents. The MCP server also ships in the dist at `main/mcp/server.js` (dependency-free, plain `node`). The eight `~/.porcelain` channel files live on the Beelink now — the daemon and the MCP server there agree on them by construction (repos ARE daemon paths).

## 6. Point the clients

- **Mac app:** Settings → General → Remote access → Remote daemon → `http://beelink:43117` + the token → Connect. The app reloads onto the Beelink's recents; Disconnect returns to local. (The packaged app's `null` origin passes CORS as-is. A DEV renderer talking to a remote daemon needs `PORCELAIN_ALLOWED_ORIGIN=http://localhost:5173` in the daemon's environment — dev-only trap, rehearsal-verified.)
- **iPad / any browser:** Safari → `http://beelink:43117`, paste the token once (remembered per-origin). Ctrl is the app's modifier there; ⌘ belongs to the browser. Plain-HTTP tailnet origins are insecure contexts — already handled app-side (`randomId`/`copyText`).

## 7. Acceptance (spec): end-to-end feature review of a repo living only on the Beelink

Changes/Feature/comments/board/terminal from the Mac app AND iPad against `beelink`; a Claude Code session in a Beelink terminal surviving a client reload (Phase 2 reattach); `vite --host` in a Beelink terminal reachable at `http://beelink:<port>` for dev-server preview.

## Rehearsal traps already burned down

- systemd `/dev/null` stdin kills the watchdog → the env hatch (above).
- Dev-renderer origin needs explicit CORS allow on the remote daemon (packaged/iPad don't).
- Docker `-p` can't reach the loopback bind — a CONTAINER artifact only; the Beelink binds its real Tailscale interface, no proxy involved.
- node-pty is compiled at `npm install` time on the target — never copy `node_modules` across machines/arches.
