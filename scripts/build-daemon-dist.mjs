#!/usr/bin/env node
// Assemble `dist-daemon/` — a self-contained, npm-installable copy of the
// Porcelain daemon that runs under PLAIN Node (no Electron, no pnpm workspace)
// on another machine (the Beelink mini-PC; plans/remote-environments.md Phase 4).
//
// It mirrors the `out/` layout exactly so the daemon's two relative resolutions
// keep working unchanged: the chunk require `../chunks/token-file-*.js` (from
// main/daemon/server.js) and RENDERER_ROOT (`__dirname/../../renderer`, see
// src/backend/static-server.ts). The five externalized runtime deps are declared
// in a generated package.json with the EXACT semver ranges read from the root
// package.json, so `npm install` on the target pulls them (and compiles node-pty
// for that host). The dependency-free MCP server ships too — the Beelink's coding
// agent spawns it under plain node with zero deps.
//
// Plain-Node ESM, zero dependencies (runs before `npm install`).

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'out')
const dist = join(root, 'dist-daemon')

// The daemon bundle is the build's headline artifact — if it's missing, the
// whole `out/` tree is stale or absent. Point the human at the one fix.
const daemonEntry = join(out, 'main', 'daemon', 'server.js')
if (!existsSync(daemonEntry)) {
  console.error('[daemon:dist] out/main/daemon/server.js not found — run `pnpm build` first')
  process.exit(1)
}

// The five externalized runtime deps the daemon bundle `require`s (see the
// electron.vite.config.ts comment + `grep require out/main/daemon/server.js`).
// node-pty is native — `npm install` on the target compiles it for that host.
const RUNTIME_DEPS = ['@trpc/server', 'node-pty', 'trash', 'ws', 'zod']

const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

// Read the EXACT range the repo pins so the standalone package can't drift from
// what the bundle was built against. A missing dep is a build-config bug, not a
// silent skip.
const dependencies = {}
for (const name of RUNTIME_DEPS) {
  const range = rootPkg.dependencies?.[name]
  if (range === undefined) {
    console.error(`[daemon:dist] ${name} missing from root package.json dependencies`)
    process.exit(1)
  }
  dependencies[name] = range
}

// Wipe and re-create fresh each run so a removed file never lingers.
rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })

// Copy the out/ pieces the daemon needs, PRESERVING their relative layout so the
// chunk require and RENDERER_ROOT resolve exactly as they do in `out/`.
const copies = [
  ['main/daemon/server.js', 'main/daemon/server.js'],
  ['main/chunks', 'main/chunks'],
  ['main/mcp/server.js', 'main/mcp/server.js'],
  ['renderer', 'renderer'],
]
for (const [from, to] of copies) {
  const src = join(out, from)
  if (!existsSync(src)) {
    console.error(`[daemon:dist] expected build output missing: out/${from}`)
    process.exit(1)
  }
  const dest = join(dist, to)
  mkdirSync(dirname(dest), { recursive: true })
  cpSync(src, dest, { recursive: true })
}

const distPkg = {
  name: 'porcelain-daemon',
  private: true,
  version: rootPkg.version,
  engines: { node: '>=22' },
  dependencies,
}
writeFileSync(join(dist, 'package.json'), `${JSON.stringify(distPkg, null, 2)}\n`)

writeFileSync(join(dist, 'README.md'), readme(rootPkg.version))

console.log(`[daemon:dist] assembled dist-daemon/ (porcelain-daemon@${rootPkg.version})`)
console.log('[daemon:dist] next: cd dist-daemon && npm install && node main/daemon/server.js')

function readme(version) {
  return `# porcelain-daemon (${version})

The standalone Porcelain **daemon** — the Electron-free backend — packaged to run
under plain Node on another machine (e.g. a Linux mini-PC on your tailnet). It
serves the app over HTTP + one WebSocket on 127.0.0.1 (and, when you enable it,
the Tailscale interface), plus the built renderer so a browser gets the same app
the Electron window loads. The dependency-free MCP server ships alongside for the
machine's coding agent (\`node main/mcp/server.js\`).

Assembled by \`pnpm daemon:dist\` from a completed \`pnpm build\`. Do not edit by
hand — regenerate.

## Requirements

- **Node ≥ 22**
- **git** on PATH (the daemon shells out to it)
- A **C toolchain** (make, g++, python3) — \`npm install\` compiles \`node-pty\`
  natively for this host.

## Install

\`\`\`sh
npm install
\`\`\`

## Run

\`\`\`sh
PORCELAIN_USER_DATA=~/.local/share/porcelain \\
PORCELAIN_DAEMON_PORT=43117 \\
node main/daemon/server.js
\`\`\`

- \`PORCELAIN_USER_DATA\` (**required**) — where the daemon keeps \`config.json\`.
- \`PORCELAIN_DAEMON_PORT\` — pins the port (omit for an OS-assigned one; the
  daemon prints \`{"port":N}\` on stdout once listening). 43117 matches the fixed
  Tailscale port the clients expect.

## Token

Every \`/trpc\` request and the \`/session\` WebSocket are token-gated. The token is
resolved once at startup:

- \`PORCELAIN_DAEMON_TOKEN\` env wins if set.
- Otherwise \`~/.porcelain/daemon-token\` is used, and **created \`0600\` on first
  run** if absent.

Copy the **same** token to every client that connects to this daemon.

## Tailnet

The daemon always binds 127.0.0.1. To also bind the Tailscale interface (fixed
port 43117), enable the setting from a connected client, or POST the toggle:

\`\`\`sh
curl -X POST -H "authorization: Bearer $TOKEN" \\
  -d true http://127.0.0.1:43117/trpc/setTailnetBind
\`\`\`

## Running under a supervisor (systemd, etc.)

**Important:** by default the daemon watches stdin and exits when it closes — that
is how the Electron shell reaps it when it dies. A supervisor typically hands
stdin as \`/dev/null\`, which reads EOF immediately and would kill the daemon on
boot. Disable the watchdog with:

\`\`\`sh
PORCELAIN_NO_STDIN_WATCHDOG=1 node main/daemon/server.js
\`\`\`

The supervisor is then responsible for the process lifetime. Example unit:

\`\`\`ini
[Unit]
Description=Porcelain daemon
After=network-online.target
Wants=network-online.target

[Service]
Environment=PORCELAIN_USER_DATA=/var/lib/porcelain
Environment=PORCELAIN_DAEMON_PORT=43117
Environment=PORCELAIN_NO_STDIN_WATCHDOG=1
# Optional: force tailnet/LAN binds without a GUI toggle
# Environment=PORCELAIN_TAILNET_BIND=1
# Environment=PORCELAIN_LAN_BIND=1
ExecStart=/usr/bin/node /opt/porcelain-daemon/main/daemon/server.js
Restart=always
\`\`\`

Prefer \`network-online.target\` over \`network.target\` so DHCP has an address
before the first bind attempt. The daemon also re-scans interfaces every 5s while
a second listener is enabled, so a remaining boot race or a later network change
still recovers without a restart.

If you run it in a shell instead, hold stdin open (e.g. under \`tmux\`) rather than
setting the escape hatch, so an interactive session still reaps it on disconnect.
`
}
