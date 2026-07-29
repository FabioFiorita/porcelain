#!/usr/bin/env node
// Assemble `dist-daemon/` — a self-contained, npm-publishable copy of the
// Porcelain daemon that runs under PLAIN Node (no Electron, no pnpm workspace)
// on another machine (the Beelink mini-PC; plans/remote-environments.md Phase 4).
//
// Primary UX (t3-style):
//   npx porcelain-daemon@latest serve --tailnet
//
// It mirrors the `out/` layout exactly so the daemon's two relative resolutions
// keep working unchanged: the shared chunk require from
// main/daemon/server.js) and RENDERER_ROOT (`__dirname/../../renderer`, see
// src/backend/static-server.ts). Externalized runtime deps are declared
// in a generated package.json with the EXACT semver ranges read from the root
// package.json, so `npm install` / npx on the target pulls them (and compiles
// node-pty for that host). The dependency-free CLI ships too — the daemon installs
// it to ~/.porcelain/porcelain on boot and the Beelink's coding agent runs it.
//
// Plain-Node ESM, zero dependencies (runs before `npm install`).

import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
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

// Externalized runtime deps used by the daemon bundle and host-management CLI.
// node-pty is native — `npm install` on the target compiles it for that host.
const RUNTIME_DEPS = ['@trpc/client', '@trpc/server', 'node-pty', 'trash', 'ws', 'zod']

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
  ['main/cli/porcelain.js', 'main/cli/porcelain.js'],
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

// CLI entry (npx porcelain-daemon serve …). Source of truth is scripts/daemon-cli.js;
// it resolves main/daemon/server.js relative to the installed package layout.
const cliSrc = join(root, 'scripts', 'daemon-cli.js')
if (!existsSync(cliSrc)) {
  console.error('[daemon:dist] scripts/daemon-cli.js missing')
  process.exit(1)
}
const binDir = join(dist, 'bin')
mkdirSync(binDir, { recursive: true })
const cliDest = join(binDir, 'porcelain-daemon.js')
// Install as .js (CJS) — package has no "type":"module", and the CLI is written
// as plain CommonJS so require(server.js) works without createRequire.
cpSync(cliSrc, cliDest)
// Executable for direct bin invocation after npm install / npx.
chmodSync(cliDest, 0o755)

// `porcelain` is already taken on npm (unrelated plate templating package).
// Publish as porcelain-daemon; bin name matches for `npx porcelain-daemon@latest`.
const distPkg = {
  name: 'porcelain-daemon',
  version: rootPkg.version,
  description:
    'Headless Porcelain daemon — plain Node backend for remote machines (npx porcelain-daemon@latest serve)',
  license: rootPkg.license ?? 'MIT',
  author: rootPkg.author,
  repository: rootPkg.repository,
  bugs: rootPkg.bugs,
  homepage: rootPkg.homepage ?? 'https://github.com/FabioFiorita/porcelain',
  engines: { node: '>=22' },
  bin: {
    'porcelain-daemon': 'bin/porcelain-daemon.js',
  },
  files: ['bin', 'main', 'renderer', 'README.md'],
  dependencies,
  publishConfig: {
    access: 'public',
  },
  keywords: ['porcelain', 'daemon', 'code-review', 'remote', 'tailscale'],
}
writeFileSync(join(dist, 'package.json'), `${JSON.stringify(distPkg, null, 2)}\n`)

writeFileSync(join(dist, 'README.md'), readme(rootPkg.version))

console.log(`[daemon:dist] assembled dist-daemon/ (porcelain-daemon@${rootPkg.version})`)
console.log('[daemon:dist] try:   cd dist-daemon && npm install && npx porcelain-daemon serve')
console.log(
  '[daemon:dist] pair:  npx porcelain-daemon access issue --name "My phone" --base-url http://127.0.0.1:43117',
)

function readme(version) {
  return `# porcelain-daemon (${version})

Headless **Porcelain** backend — the Electron-free daemon + renderer, packaged for
plain Node on any machine (Linux mini-PC, cloud VM, laptop). Same credential-gated
HTTP/WS surface the Mac app and browser clients already talk to.

## Quick start (recommended)

On the remote host (Node ≥ 22, git, and a C toolchain for \`node-pty\`):

\`\`\`sh
npx porcelain-daemon@latest serve --tailnet --funnel
\`\`\`

That:

1. Fetches the **latest** published package (use \`@latest\` so you don't stick on a
   stale npx cache of an older version).
2. Compiles \`node-pty\` for this host on first install.
3. Starts the daemon on port **43117**, with private Tailscale access and opt-in
   public HTTPS through Tailscale Funnel.
4. Keeps host administration local; it never prints the administrator credential.

Leave the process in the foreground while you work (Termius / tmux / SSH session).
Ctrl+C stops it — **no systemd required**. Start it when you sit down; stop it
when you're done.

### Pair a device

\`\`\`sh
npx porcelain-daemon@latest access issue --name "My phone"
\`\`\`

Open the printed connection link in a browser, or paste it into the Mac app's
**Settings → Remotes**. The link expires in 15 minutes, works once, and becomes
an individually revocable device credential. Manage access only on the host:

\`\`\`sh
npx porcelain-daemon@latest access list
npx porcelain-daemon@latest access revoke <id>
npx porcelain-daemon@latest share status
\`\`\`

## CLI

\`\`\`text
porcelain-daemon serve [options]
porcelain-daemon access issue --name <device> [--base-url <url>]
porcelain-daemon access list | revoke <id>
porcelain-daemon share status | lan|tailnet|funnel on|off

  --port <n>           Port (default 43117)
  --user-data <path>   Config dir (default ~/.local/share/porcelain)
  --tailnet            Bind Tailscale interface too
  --lan                Bind RFC1918 LAN addresses too
  --funnel             Publish loopback over Tailscale Funnel HTTPS
  --no-watchdog        For systemd / supervisors (stdin is /dev/null)
\`\`\`

Porcelain always binds loopback, never \`0.0.0.0\`. Private listeners are explicit.
Funnel is public HTTPS but still credential-gated, and Porcelain refuses to replace
or disable a Funnel target it does not own.

## Always-on (optional)

If you *do* want a supervised process, use \`--no-watchdog\` and a unit like:

\`\`\`ini
[Service]
Environment=PORCELAIN_USER_DATA=%h/.local/share/porcelain
Environment=PORCELAIN_DAEMON_PORT=43117
Environment=PORCELAIN_TAILNET_BIND=1
Environment=PORCELAIN_NO_STDIN_WATCHDOG=1
ExecStart=/usr/bin/npx --yes porcelain-daemon@latest serve --no-watchdog --tailnet
Restart=on-failure
\`\`\`

Prefer a real \`node\` binary over Volta/fnm/nvm shims in \`ExecStart\` when pinning
a global install instead of npx.

## Agent CLI (channel access)

The dependency-free CLI ships at \`main/cli/porcelain.js\`. On every \`serve\`, the
daemon installs it to the stable path agents run:

\`\`\`sh
~/.porcelain/porcelain <noun> <verb>
\`\`\`

So upgrading the daemon (\`npx porcelain-daemon@latest\`) ships new CLI commands
automatically — agents run a binary, so there's nothing to register.

Direct package path (debug only; agents should use the installed home path):

\`\`\`sh
node path/to/package/main/cli/porcelain.js
\`\`\`

## Requirements

- **Node ≥ 22**
- **git** on PATH
- A **C toolchain** (make, g++, python3) — first install compiles \`node-pty\`

## Develop / ship from the monorepo

\`\`\`sh
pnpm build && pnpm daemon:dist
cd dist-daemon && npm publish --access public
\`\`\`

Assembled by \`pnpm daemon:dist\` from a completed \`pnpm build\`. Do not edit
\`dist-daemon/\` by hand — regenerate.
`
}
