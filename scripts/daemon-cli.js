#!/usr/bin/env node
// Headless CLI for the published porcelain-daemon package.
// Copied into dist-daemon/bin/ by scripts/build-daemon-dist.mjs — not run from
// the monorepo root (paths resolve relative to the installed package layout).
//
// Goal: t3-style one-liner on a remote box —
//   npx porcelain-daemon@latest serve --tailnet
// instead of scp'ing a dist tarball and wiring systemd.

const { randomBytes } = require('node:crypto')
const {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} = require('node:fs')
const { homedir } = require('node:os')
const { dirname, join } = require('node:path')
const { createTRPCUntypedClient, httpLink } = require('@trpc/client')

const DEFAULT_PORT = 43117
const DEFAULT_USER_DATA = join(homedir(), '.local', 'share', 'porcelain')
// PORCELAIN_HOME redirects token + channels (dev stack uses ~/.porcelain-dev).
const porcelainHome = () => process.env.PORCELAIN_HOME ?? join(homedir(), '.porcelain')
const ADMIN_TOKEN_PATH = () =>
  process.env.PORCELAIN_ADMIN_TOKEN_FILE ?? join(porcelainHome(), 'admin-token')

const HELP = `porcelain-daemon — headless Porcelain backend (plain Node, no Electron)

Usage:
  porcelain-daemon serve [options]
  porcelain-daemon [options]              (same as serve)
  porcelain-daemon access issue --name <device> [--base-url <url>]
  porcelain-daemon access list
  porcelain-daemon access revoke <id>
  porcelain-daemon share status
  porcelain-daemon share lan|tailnet|cloudflare on|off

Options:
  --port <n>           Listen port for loopback AND LAN/tailnet (default ${DEFAULT_PORT})
  --user-data <path>   Config dir (default ${DEFAULT_USER_DATA})
  --lan                Also bind RFC1918 LAN addresses (same --port)
  --tailnet            Also bind the Tailscale interface (same --port)
  --cloudflare         Publish loopback over a Cloudflare quick tunnel
  --allowed-origin <origin>
                       Trust a browser Hub origin for cross-origin API/WS (repeatable)
  --no-watchdog        Disable stdin parent-death watchdog (required under systemd)
  -h, --help           Show this help

Host-management options:
  --daemon-url <url>   Loopback daemon URL when not using the default port
  --base-url <url>     Reachable URL to embed in a new connection link

Examples:
  npx porcelain-daemon@latest serve --lan
  npx porcelain-daemon@latest serve --lan --tailnet
  npx porcelain-daemon@latest serve --lan --cloudflare
  npx porcelain-daemon@latest access issue --name "My phone"
  npx porcelain-daemon@latest serve --port 43118 --lan

Env (same as the raw daemon; flags set these when passed):
  PORCELAIN_USER_DATA, PORCELAIN_DAEMON_PORT, PORCELAIN_ADMIN_TOKEN,
  PORCELAIN_ALLOWED_ORIGIN (comma-separated), PORCELAIN_ALLOWED_ORIGINS (comma-separated),
  PORCELAIN_TAILNET_BIND, PORCELAIN_LAN_BIND, PORCELAIN_CLOUDFLARE_BIND,
  PORCELAIN_NO_STDIN_WATCHDOG

Notes:
  • Always binds 127.0.0.1; --tailnet / --lan add private interfaces only
    (never 0.0.0.0). Cloudflare proxies only the loopback listener.
  • --tailnet and --cloudflare are mutually exclusive. LAN can combine with either.
  • Host administration lives at ~/.porcelain/admin-token (0600) and is never shared.
  • Pairing links are one-time credentials; clients receive individually revocable access.
  • Use @latest so each invoke can pick up a newer published package.
  • First install compiles node-pty for this host (needs a C toolchain).
`

function fail(message) {
  console.error(`[porcelain-daemon] ${message}`)
  process.exit(1)
}

/**
 * Minimal argv parse — no deps in the published package beyond the daemon's.
 * Unknown flags / missing values exit non-zero with a short message.
 */
function parseArgs(argv) {
  const opts = {
    command: 'serve',
    port: DEFAULT_PORT,
    userData: DEFAULT_USER_DATA,
    tailnet: false,
    lan: false,
    cloudflare: false,
    noWatchdog: false,
    allowedOrigins: [],
    help: false,
  }

  let i = 0
  // Bare invocation and explicit `serve` both mean serve (t3-compatible).
  if (argv[0] === 'serve') {
    i = 1
  } else if (argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h') {
    opts.help = true
    return opts
  }

  while (i < argv.length) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') {
      opts.help = true
      i += 1
      continue
    }
    if (arg === '--tailnet') {
      opts.tailnet = true
      i += 1
      continue
    }
    if (arg === '--lan') {
      opts.lan = true
      i += 1
      continue
    }
    if (arg === '--cloudflare') {
      opts.cloudflare = true
      i += 1
      continue
    }
    if (arg === '--funnel') {
      fail('Tailscale Funnel was removed. Use --cloudflare for public HTTPS.')
    }
    if (arg === '--no-watchdog') {
      opts.noWatchdog = true
      i += 1
      continue
    }
    if (arg === '--allowed-origin' || arg === '--allowed-origins') {
      const raw = argv[i + 1]
      if (raw === undefined) fail(`${arg} requires a value`)
      opts.allowedOrigins.push(raw)
      i += 2
      continue
    }
    if (arg === '--port') {
      const raw = argv[i + 1]
      if (raw === undefined) fail('--port requires a value')
      const port = Number(raw)
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        fail(`--port must be an integer 1–65535 (got ${raw})`)
      }
      opts.port = port
      i += 2
      continue
    }
    if (arg === '--user-data') {
      const raw = argv[i + 1]
      if (raw === undefined) fail('--user-data requires a path')
      opts.userData = raw
      i += 2
      continue
    }
    fail(`unknown argument: ${arg}\n\n${HELP}`)
  }

  return opts
}

/** Same semantics as apps/daemon/src/net/admin-token.ts (plain CJS copy). */
function ensureAdminToken(path = ADMIN_TOKEN_PATH()) {
  try {
    const existing = readFileSync(path, 'utf8').trim()
    if (existing !== '') {
      chmodSync(path, 0o600)
      return existing
    }
  } catch {
    // absent — mint
  }
  const token = randomBytes(32).toString('hex')
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, token, { encoding: 'utf8', mode: 0o600 })
  renameSync(tmp, path)
  return token
}

// The built contracts module (scripts/build-node.mjs), in the two layouts this script
// ships in: the installed package (bin/ beside main/) and the monorepo checkout (scripts/
// beside apps/desktop/out/main/). Same relative-resolution mechanism the serve path already
// uses for main/daemon/server.js.
const PROTOCOL_MODULES = [
  join(__dirname, '..', 'main', 'contracts', 'protocol.js'),
  join(__dirname, '..', 'apps', 'desktop', 'out', 'main', 'contracts', 'protocol.js'),
]

/**
 * The daemon refuses any request that does not announce its exact wire protocol, so this
 * CLI announces it too — read from the built contracts, never a literal copied here, which
 * would silently become a lie the day the protocol moves.
 */
function protocolHeaders() {
  const modulePath = PROTOCOL_MODULES.find((candidate) => existsSync(candidate))
  if (modulePath === undefined) {
    fail('protocol contracts missing — run `pnpm build` in the monorepo, or reinstall the package')
  }
  const { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER } = require(modulePath)
  return { [PROTOCOL_VERSION_HEADER]: String(PROTOCOL_VERSION) }
}

function adminClient(daemonUrl, token) {
  return createTRPCUntypedClient({
    links: [
      httpLink({
        url: `${daemonUrl}/trpc`,
        headers: { authorization: `Bearer ${token}`, ...protocolHeaders() },
      }),
    ],
  })
}

function adminCommandOptions(argv) {
  const result = {
    args: [],
    daemonUrl: `http://127.0.0.1:${process.env.PORCELAIN_DAEMON_PORT || DEFAULT_PORT}`,
    baseUrl: null,
    name: null,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--daemon-url' || arg === '--base-url' || arg === '--name') {
      const value = argv[i + 1]
      if (!value) fail(`${arg} requires a value`)
      if (arg === '--daemon-url') result.daemonUrl = value.replace(/\/+$/, '')
      else if (arg === '--base-url') result.baseUrl = value
      else result.name = value
      i += 1
    } else {
      result.args.push(arg)
    }
  }
  return result
}

async function suggestedBaseUrl(client) {
  const lan = await client.query('lanStatus').catch(() => null)
  if (lan?.numericUrl || lan?.url) return lan.numericUrl || lan.url
  const tailnet = await client.query('tailnetStatus').catch(() => null)
  if (tailnet?.url) return tailnet.url
  const cloudflare = await client.query('cloudflareStatus').catch(() => null)
  return cloudflare?.url || null
}

async function runAccessCommand(argv) {
  const options = adminCommandOptions(argv)
  const [action, id] = options.args
  const client = adminClient(options.daemonUrl, ensureAdminToken())
  if (action === 'issue') {
    if (!options.name) fail('access issue requires --name <device>')
    const baseUrl = options.baseUrl || (await suggestedBaseUrl(client))
    if (!baseUrl) fail('no reachable endpoint is enabled; pass --base-url explicitly')
    const result = await client.mutation('issuePairingLink', {
      label: options.name,
      baseUrl,
    })
    process.stdout.write(`${result.url}\n`)
    return
  }
  if (action === 'list') {
    const status = await client.query('accessStatus')
    process.stdout.write(`${JSON.stringify(status, null, 2)}\n`)
    return
  }
  if (action === 'revoke' && id) {
    const status = await client.query('accessStatus')
    if (status.clients.some((entry) => entry.id === id)) {
      await client.mutation('revokeAuthorizedClient', id)
    } else if (status.pairings.some((entry) => entry.id === id)) {
      await client.mutation('revokePairingLink', id)
    } else {
      fail(`no device or pairing link has id ${id}`)
    }
    process.stdout.write(`Revoked ${id}\n`)
    return
  }
  fail('usage: porcelain-daemon access issue --name <device> | list | revoke <id>')
}

async function runShareCommand(argv) {
  const options = adminCommandOptions(argv)
  const [target, value] = options.args
  const client = adminClient(options.daemonUrl, ensureAdminToken())
  if (target === 'status') {
    const [lan, tailnet, cloudflare] = await Promise.all([
      client.query('lanStatus'),
      client.query('tailnetStatus'),
      client.query('cloudflareStatus'),
    ])
    process.stdout.write(`${JSON.stringify({ lan, tailnet, cloudflare }, null, 2)}\n`)
    return
  }
  if (target === 'funnel') {
    fail('Tailscale Funnel was removed. Use share cloudflare on|off.')
  }
  const procedures = {
    lan: 'setLanBind',
    tailnet: 'setTailnetBind',
    cloudflare: 'setCloudflareBind',
  }
  const procedure = procedures[target]
  if (!procedure || (value !== 'on' && value !== 'off')) {
    fail('usage: porcelain-daemon share status | lan|tailnet|cloudflare on|off')
  }
  const status = await client.mutation(procedure, value === 'on')
  process.stdout.write(`${JSON.stringify(status, null, 2)}\n`)
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv[0] === 'access') {
    await runAccessCommand(argv.slice(1))
    return
  }
  if (argv[0] === 'share') {
    await runShareCommand(argv.slice(1))
    return
  }
  const opts = parseArgs(argv)
  if (opts.help) {
    process.stdout.write(HELP)
    process.exit(0)
  }

  // Prefer an already-set env (systemd unit, shell export) over flag defaults.
  if (!process.env.PORCELAIN_USER_DATA) {
    process.env.PORCELAIN_USER_DATA = opts.userData
  }
  if (!process.env.PORCELAIN_DAEMON_PORT) {
    process.env.PORCELAIN_DAEMON_PORT = String(opts.port)
  }
  // Preserve an explicitly supplied service environment. A flag supplies the same
  // comma-separated format as PORCELAIN_ALLOWED_ORIGIN and is repeated for several Hubs.
  if (
    opts.allowedOrigins.length > 0 &&
    !process.env.PORCELAIN_ALLOWED_ORIGIN &&
    !process.env.PORCELAIN_ALLOWED_ORIGINS
  ) {
    process.env.PORCELAIN_ALLOWED_ORIGIN = opts.allowedOrigins.join(',')
  }
  if (opts.tailnet && opts.cloudflare) {
    fail('--tailnet and --cloudflare cannot be used together. Pick one off-network route.')
  }
  if (opts.tailnet) process.env.PORCELAIN_TAILNET_BIND = '1'
  if (opts.lan) process.env.PORCELAIN_LAN_BIND = '1'
  if (opts.cloudflare) process.env.PORCELAIN_CLOUDFLARE_BIND = '1'
  if (opts.noWatchdog) process.env.PORCELAIN_NO_STDIN_WATCHDOG = '1'

  const token = process.env.PORCELAIN_ADMIN_TOKEN || ensureAdminToken()
  process.env.PORCELAIN_ADMIN_TOKEN = token

  const userData = process.env.PORCELAIN_USER_DATA
  const port = process.env.PORCELAIN_DAEMON_PORT
  const binds = ['127.0.0.1']
  if (process.env.PORCELAIN_TAILNET_BIND === '1') binds.push('tailnet')
  if (process.env.PORCELAIN_LAN_BIND === '1') binds.push('lan')
  if (process.env.PORCELAIN_CLOUDFLARE_BIND === '1') binds.push('cloudflare')
  const allowedOriginValue =
    process.env.PORCELAIN_ALLOWED_ORIGINS || process.env.PORCELAIN_ALLOWED_ORIGIN || ''
  const allowedOriginCount = allowedOriginValue
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean).length

  // Human-facing status on stderr; the daemon still owns the one stdout port line.
  console.error(`[porcelain-daemon] user data  ${userData}`)
  console.error(`[porcelain-daemon] port       ${port}`)
  console.error(`[porcelain-daemon] binds      ${binds.join(', ')}`)
  console.error(
    `[porcelain-daemon] cors       ${allowedOriginCount === 0 ? 'same-origin only' : `${allowedOriginCount} trusted Hub origin(s) configured`}`,
  )
  console.error(`[porcelain-daemon] admin file ${ADMIN_TOKEN_PATH()}`)
  console.error('[porcelain-daemon] pair with: porcelain-daemon access issue --name <device>')
  console.error('[porcelain-daemon] starting…  Ctrl+C to stop')

  const serverEntry = [
    join(__dirname, '..', 'main', 'daemon', 'server.js'),
    // Monorepo fallback used by the composed proof; the published package uses
    // the first layout above after `daemon:dist` assembles it.
    join(__dirname, '..', 'apps', 'desktop', 'out', 'main', 'daemon', 'server.js'),
  ].find((candidate) => existsSync(candidate))
  if (serverEntry === undefined) {
    fail('daemon entry missing — package is corrupt; reinstall')
  }
  // Side-effect entry: boots the HTTP/WS listeners (same as `node main/daemon/server.js`).
  require(serverEntry)
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
