# Phase 4 — Beelink bring-up runbook

**Status:** prep code SHIPPED 2026-07-04 (05fe1b8 daemon dist, 30cdfb6 remote-daemon connection); **npx publish path SHIPPED 2026-07-16** (no more scp tarball as the default). Ops below wait for / refine against the hardware.

Everything here was rehearsed against a `node:22` Linux container in OrbStack on 2026-07-04: `npm install` compiled node-pty, auth/static/repo-open/PTY-over-WS all verified, and the Mac app connected → browsed the Linux disk → opened a repo → ran a remote bash → disconnected cleanly. Arrival day is this checklist, not a debugging session.

## 0. What the Beelink needs installed

- **Tailscale** — `curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up --ssh` (SSH on, per the spec). Note the MagicDNS name (`beelink` below).
- **Node ≥ 22** (nodesource or nvm), **git**, and a **build toolchain** for node-pty (`sudo apt install -y build-essential python3` on Debian/Ubuntu).
- **Claude Code** (`npm i -g @anthropic-ai/claude-code` or the installer) — the whole point of the box.

## 1. Run the daemon (preferred — on-demand)

No tarball, no `~/porcelain-daemon` install tree, no always-on systemd. SSH in when you start work:

```sh
npx porcelain-daemon@latest serve --tailnet --print-token
```

Leave it in the foreground (Termius tab / `tmux`). Ctrl+C when you're done for the day.

- `@latest` asks the registry for the newest published version (npx still reuses a local cache when that version is already installed — re-running with `@latest` is what picks up a newer release after a Mac app ship).
- First run compiles `node-pty` for the Beelink's ABI (needs the C toolchain from §0).
- Token is minted at `~/.porcelain/daemon-token` (0600) on first run; `--print-token` shows it for pairing.

### Pair once (token fleet)

If the Mac already has a token you want to share fleet-wide:

```sh
ssh beelink 'mkdir -p ~/.porcelain && chmod 700 ~/.porcelain'
scp ~/.porcelain/daemon-token beelink:.porcelain/daemon-token
ssh beelink 'chmod 600 ~/.porcelain/daemon-token'
```

Then start without `--print-token` (same secret). Or copy the printed token into Mac Settings.

### Optional: always-on systemd

Only if you want the daemon up without an open SSH session. Use `--no-watchdog` (systemd hands `/dev/null` as stdin and would otherwise trip the parent-death watchdog):

```ini
# ~/.config/systemd/user/porcelain-daemon.service
[Unit]
Description=Porcelain daemon
After=network-online.target
Wants=network-online.target

[Service]
Environment=PORCELAIN_USER_DATA=%h/.local/share/porcelain
Environment=PORCELAIN_DAEMON_PORT=43117
Environment=PORCELAIN_TAILNET_BIND=1
Environment=PORCELAIN_NO_STDIN_WATCHDOG=1
ExecStart=/usr/bin/npx --yes porcelain-daemon@latest serve --no-watchdog --tailnet
Restart=on-failure

[Install]
WantedBy=default.target
```

```sh
systemctl --user enable --now porcelain-daemon
loginctl enable-linger $USER
```

Prefer `network-online.target` so DHCP/Tailscale have an address before the first bind; the daemon also re-scans interfaces every 5s while a second listener is enabled.

## 1b. Legacy: ship a local dist tarball

Only needed when iterating on an **unpublished** daemon build (or before the package is on npm via a release tag / Trusted Publishing). On the Mac:

```sh
pnpm build && pnpm daemon:dist
tar czf porcelain-daemon.tgz -C dist-daemon .
scp porcelain-daemon.tgz beelink:
```

On the Beelink:

```sh
mkdir -p ~/porcelain-daemon && tar xzf porcelain-daemon.tgz -C ~/porcelain-daemon
cd ~/porcelain-daemon && npm install
node bin/porcelain-daemon.js serve --tailnet --print-token
# or: node main/daemon/server.js  with env vars (raw entry)
```

## 2. Repos + agent channel

```sh
ssh beelink 'mkdir -p ~/Code && cd ~/Code && git clone <your repos>'
```

Claude Code + porcelain MCP plugin on the Beelink: use Settings → Agents from a client already pointed at this daemon (remote-aware install), or copy `~/.porcelain/plugin` from the Mac and run the two `claude plugin` commands. The MCP server also ships in the package at `main/mcp/server.js` (dependency-free, plain `node`). The eight `~/.porcelain` channel files live on the Beelink — the daemon and the MCP server there agree on them by construction (repos ARE daemon paths).

## 3. Point the clients

- **Mac app:** Settings → General → Remote access → Remote daemon → `http://beelink:43117` + the token → Connect. The app reloads onto the Beelink's recents; Disconnect returns to local. (The packaged app's `null` origin passes CORS as-is. A DEV renderer talking to a remote daemon needs `PORCELAIN_ALLOWED_ORIGIN=http://localhost:5173` in the daemon's environment — dev-only trap, rehearsal-verified.)
- **iPad / any browser:** Safari → `http://beelink:43117`, paste the token once (remembered per-origin). Ctrl is the app's modifier there; ⌘ belongs to the browser. Plain-HTTP tailnet origins are insecure contexts — already handled app-side (`randomId`/`copyText`).

## 4. Acceptance (spec): end-to-end feature review of a repo living only on the Beelink

Changes/Feature/comments/board/terminal from the Mac app AND iPad against `beelink`; a Claude Code session in a Beelink terminal surviving a client reload (Phase 2 reattach); `vite --host` in a Beelink terminal reachable at `http://beelink:<port>` for dev-server preview.

## Rehearsal traps already burned down

- systemd `/dev/null` stdin kills the watchdog → `--no-watchdog` / `PORCELAIN_NO_STDIN_WATCHDOG=1`.
- Dev-renderer origin needs explicit CORS allow on the remote daemon (packaged/iPad don't).
- Docker `-p` can't reach the loopback bind — a CONTAINER artifact only; the Beelink binds its real Tailscale interface, no proxy involved.
- node-pty is compiled at install time on the target — never copy `node_modules` across machines/arches.
- npm package name is **`porcelain-daemon`** (`porcelain` is taken on the registry by an unrelated package).
