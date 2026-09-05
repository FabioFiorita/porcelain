#!/usr/bin/env node
// Assemble `dist-daemon/` — a self-contained, npm-publishable copy of the
// Porcelain daemon that runs under PLAIN Node (no Electron, no pnpm workspace)
// on another machine (see docs/remote-access.md for the supported deployment path).
//
// Usage:
//   npx @fabiofiorita/porcelain@latest serve --tailnet
//
// It preserves RENDERER_ROOT (`__dirname/../../renderer`, see
// apps/daemon/src/net/static-server.ts). Externalized runtime deps are declared
// in a generated package.json with the EXACT semver ranges read from
// apps/daemon/package.json, so `npm install` / npx on the target pulls them (and compiles
// node-pty for that host).
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
const desktop = join(root, 'apps', 'desktop')
const out = join(desktop, 'out')
const dist = join(root, 'dist-daemon')

// The daemon bundle is the build's headline artifact — if it's missing, the
// whole `out/` tree is stale or absent. Point the human at the one fix.
const daemonEntry = join(out, 'main', 'daemon', 'server.js')
if (!existsSync(daemonEntry)) {
  console.error(
    '[daemon:dist] apps/desktop/out/main/daemon/server.js not found — run `pnpm build` first',
  )
  process.exit(1)
}

// Externalized runtime dependencies used by the daemon bundle.
// node-pty is native — `npm install` on the target compiles it for that host.
const RUNTIME_DEPS = ['@trpc/client', '@trpc/server', 'node-pty', 'trash', 'ws', 'zod']

const desktopPkg = JSON.parse(readFileSync(join(desktop, 'package.json'), 'utf8'))
const daemonPkgPath = join(root, 'apps', 'daemon', 'package.json')
const daemonPkg = JSON.parse(readFileSync(daemonPkgPath, 'utf8'))

// Read the EXACT range the repo pins so the standalone package can't drift from
// what the bundle was built against. A missing dep is a build-config bug, not a
// silent skip.
const dependencies = {}
for (const name of RUNTIME_DEPS) {
  const range = daemonPkg.dependencies?.[name]
  if (range === undefined) {
    console.error(`[daemon:dist] ${name} missing from apps/daemon/package.json dependencies`)
    process.exit(1)
  }
  dependencies[name] = range
}

// Validate all inputs before replacing the previous package.
for (const input of [
  join(out, 'main/contracts/protocol.js'),
  join(out, 'renderer/index.html'),
  join(root, 'scripts/porcelain-host.js'),
]) {
  if (!existsSync(input)) throw new Error(`Required packaging input missing: ${input}`)
}

// Wipe and re-create fresh each run so a removed file never lingers.
rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })

// Copy the out/ pieces the daemon needs, PRESERVING their relative layout so
// RENDERER_ROOT (`__dirname/../../renderer` from main/daemon/server.js) resolves.
const requiredCopies = [
  ['main/daemon/server.js', 'main/daemon/server.js'],
  // Wire protocol constants bin/porcelain.js requires.
  ['main/contracts/protocol.js', 'main/contracts/protocol.js'],
  ['renderer', 'renderer'],
]
for (const [from, to] of requiredCopies) {
  const src = join(out, from)
  if (!existsSync(src)) {
    console.error(`[daemon:dist] expected build output missing: apps/desktop/out/${from}`)
    process.exit(1)
  }
  const dest = join(dist, to)
  mkdirSync(dirname(dest), { recursive: true })
  cpSync(src, dest, { recursive: true })
}

// Host launcher entry (npx @fabiofiorita/porcelain serve …). Source of truth is scripts/porcelain-host.js;
// it resolves main/daemon/server.js relative to the installed package layout.
const cliSrc = join(root, 'scripts', 'porcelain-host.js')
if (!existsSync(cliSrc)) {
  console.error('[daemon:dist] scripts/porcelain-host.js missing')
  process.exit(1)
}
const binDir = join(dist, 'bin')
mkdirSync(binDir, { recursive: true })
const cliDest = join(binDir, 'porcelain.js')
// Install as .js (CJS) — package has no "type":"module", and the host launcher is written
// as plain CommonJS so require(server.js) works without createRequire.
cpSync(cliSrc, cliDest)
// Executable for direct bin invocation after npm install / npx.
chmodSync(cliDest, 0o755)

// Publish the scoped package so the executable can use the unscoped `porcelain` name.
const distPkg = {
  name: '@fabiofiorita/porcelain',
  version: daemonPkg.version,
  description:
    'Headless Porcelain daemon — plain Node backend for remote machines (npx @fabiofiorita/porcelain@latest serve)',
  license: desktopPkg.license ?? 'MIT',
  author: desktopPkg.author,
  repository: desktopPkg.repository,
  bugs: desktopPkg.bugs,
  homepage: desktopPkg.homepage ?? 'https://github.com/FabioFiorita/porcelain',
  engines: { node: '>=22' },
  bin: {
    porcelain: 'bin/porcelain.js',
  },
  files: ['bin', 'main', 'renderer', 'README.md'],
  dependencies,
  publishConfig: {
    access: 'public',
  },
  keywords: ['porcelain', 'daemon', 'code-review', 'remote', 'tailscale'],
}
writeFileSync(join(dist, 'package.json'), `${JSON.stringify(distPkg, null, 2)}\n`)

writeFileSync(join(dist, 'README.md'), readme(daemonPkg.version))

console.log(`[daemon:dist] assembled dist-daemon/ (@fabiofiorita/porcelain@${daemonPkg.version})`)
console.log(
  '[daemon:dist] try:   cd dist-daemon && npm install && npx @fabiofiorita/porcelain serve',
)
console.log(
  '[daemon:dist] pair:  npx @fabiofiorita/porcelain access issue --name "My phone" --base-url http://127.0.0.1:43117',
)

function readme(version) {
  return `# @fabiofiorita/porcelain (${version})

The Electron-free Porcelain daemon and browser client, packaged for plain Node. Run it on the
machine that owns the repositories and terminals you want to review.

## Start and pair

The host needs Node 22+, Git, and a C toolchain for the first \`node-pty\` build:

\`\`\`sh
npx @fabiofiorita/porcelain@latest serve
npx @fabiofiorita/porcelain@latest access issue --name "My device"
\`\`\`

Porcelain always binds loopback and never \`0.0.0.0\`. Add \`--lan\`, \`--tailnet\`, or
\`--cloudflare\` only for the route you intend to expose. Every client uses its own one-time pairing
link; the host administrator token is never shared. Manage paired devices on the host:

\`\`\`sh
npx @fabiofiorita/porcelain@latest access list
npx @fabiofiorita/porcelain@latest access revoke <id>
npx @fabiofiorita/porcelain@latest share status
\`\`\`

For exposure flags, browser origins, systemd, updates, and troubleshooting, use the current
[remote-access guide](https://github.com/FabioFiorita/porcelain/blob/main/docs/remote-access.md) and
\`porcelain --help\` rather than copying a service file from an older package version.

## Agent connection

Install the Porcelain plugin through the agent's plugin manager. Its bundled stdio connector
forwards MCP to the matching daemon's profile-scoped local OS socket; it is not exposed through the
daemon's LAN, Tailscale, Cloudflare, or renderer HTTP routes. Claude Code can install it with:

\`\`\`text
/plugin marketplace add FabioFiorita/porcelain
/plugin install porcelain@porcelain
\`\`\`

## Repository packaging

\`\`\`sh
pnpm build && pnpm daemon:dist
\`\`\`

\`dist-daemon/\` is generated from the completed product build; do not edit it by hand.
`
}
