#!/usr/bin/env node
// Headless CLI for the published porcelain-daemon package.
// Copied into dist-daemon/bin/ by scripts/build-daemon-dist.mjs — not run from
// the monorepo root (paths resolve relative to the installed package layout).
//
// Goal: t3-style one-liner on a remote box —
//   npx porcelain-daemon@latest serve --tailnet
// instead of scp'ing a dist tarball and wiring systemd.

const { randomBytes } = require('node:crypto')
const { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } = require('node:fs')
const { homedir } = require('node:os')
const { dirname, join } = require('node:path')

const DEFAULT_PORT = 43117
const DEFAULT_USER_DATA = join(homedir(), '.local', 'share', 'porcelain')
const TOKEN_PATH = join(homedir(), '.porcelain', 'daemon-token')

const HELP = `porcelain-daemon — headless Porcelain backend (plain Node, no Electron)

Usage:
  porcelain-daemon serve [options]
  porcelain-daemon [options]              (same as serve)

Options:
  --port <n>           Listen port (default ${DEFAULT_PORT})
  --user-data <path>   Config dir (default ${DEFAULT_USER_DATA})
  --tailnet            Also bind the Tailscale interface (port ${DEFAULT_PORT})
  --lan                Also bind RFC1918 LAN addresses (port ${DEFAULT_PORT})
  --no-watchdog        Disable stdin parent-death watchdog (required under systemd)
  --print-token        Print the daemon token to stderr (for pairing a new client)
  -h, --help           Show this help

Examples:
  npx porcelain-daemon@latest serve --tailnet
  npx porcelain-daemon@latest serve --tailnet --lan --print-token

Env (same as the raw daemon; flags set these when passed):
  PORCELAIN_USER_DATA, PORCELAIN_DAEMON_PORT, PORCELAIN_DAEMON_TOKEN,
  PORCELAIN_TAILNET_BIND, PORCELAIN_LAN_BIND, PORCELAIN_NO_STDIN_WATCHDOG

Notes:
  • Always binds 127.0.0.1; --tailnet / --lan add private interfaces only
    (never 0.0.0.0). Same token gate on every listener.
  • Token lives at ~/.porcelain/daemon-token (0600). Created on first run.
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
    noWatchdog: false,
    printToken: false,
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
    if (arg === '--no-watchdog') {
      opts.noWatchdog = true
      i += 1
      continue
    }
    if (arg === '--print-token') {
      opts.printToken = true
      i += 1
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

/** Same semantics as src/backend/token-file.ts ensureDaemonToken (plain CJS copy). */
function ensureDaemonToken(path = TOKEN_PATH) {
  try {
    const existing = readFileSync(path, 'utf8').trim()
    if (existing !== '') return existing
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

function main() {
  const opts = parseArgs(process.argv.slice(2))
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
  if (opts.tailnet) process.env.PORCELAIN_TAILNET_BIND = '1'
  if (opts.lan) process.env.PORCELAIN_LAN_BIND = '1'
  if (opts.noWatchdog) process.env.PORCELAIN_NO_STDIN_WATCHDOG = '1'

  // Mint/load the shared token and pass it via env so an interactive TTY does not
  // hit the daemon's "token required" exit (server.ts only auto-reads the file
  // when stdin is non-TTY).
  const token = process.env.PORCELAIN_DAEMON_TOKEN || ensureDaemonToken()
  process.env.PORCELAIN_DAEMON_TOKEN = token

  const userData = process.env.PORCELAIN_USER_DATA
  const port = process.env.PORCELAIN_DAEMON_PORT
  const binds = ['127.0.0.1']
  if (process.env.PORCELAIN_TAILNET_BIND === '1') binds.push('tailnet')
  if (process.env.PORCELAIN_LAN_BIND === '1') binds.push('lan')

  // Human-facing status on stderr; the daemon still owns the one stdout port line.
  console.error(`[porcelain-daemon] user data  ${userData}`)
  console.error(`[porcelain-daemon] port       ${port}`)
  console.error(`[porcelain-daemon] binds      ${binds.join(', ')}`)
  console.error(`[porcelain-daemon] token file ${TOKEN_PATH}`)
  if (opts.printToken) {
    console.error(`[porcelain-daemon] token      ${token}`)
  } else {
    console.error('[porcelain-daemon] (pass --print-token to show the token for pairing)')
  }
  console.error('[porcelain-daemon] starting…  Ctrl+C to stop')

  const serverEntry = join(__dirname, '..', 'main', 'daemon', 'server.js')
  if (!existsSync(serverEntry)) {
    fail(`daemon entry missing at ${serverEntry} — package is corrupt; reinstall`)
  }
  // Side-effect entry: boots the HTTP/WS listeners (same as `node main/daemon/server.js`).
  require(serverEntry)
}

main()
