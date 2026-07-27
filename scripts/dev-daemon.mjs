#!/usr/bin/env node
/**
 * Start the local-tree daemon on the DEV stack (default port 43118, porcelain-dev data).
 *
 * This is NOT the published `porcelain-daemon` npm package — that is for production
 * hosts (`npx porcelain-daemon@latest serve`). Day-to-day product work uses this
 * launcher against a built tree (`pnpm build` once, then restart here).
 *
 * Usage (pnpm needs `--` before flags):
 *   pnpm dev:daemon
 *   pnpm dev:daemon -- --host
 *   pnpm dev:daemon -- --port 43119 --host
 *   pnpm dev:daemon -- --loopback
 *   pnpm dev:daemon -- --print-token
 */
import { execSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEV_HOME,
  DEV_PLAYGROUND,
  DEV_PORT,
  DEV_TOKEN_FILE,
  DEV_USER_DATA,
  devEnv,
  ensureDevToken,
} from './dev-env.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const serverEntry = join(root, 'out', 'main', 'daemon', 'server.js')

const HELP = `Porcelain DEV daemon — local tree on the isolated dev stack

Usage:
  pnpm dev:daemon -- [options]

Options:
  --host, --lan        Bind LAN (RFC1918) so other machines can open
                       http://<host>.local:<port>/  (default: on)
  --loopback, --no-host
                       Loopback only (127.0.0.1) — no LAN share
  --tailnet            Also bind Tailscale (100.64/10) on the same port
  --port <n>           Listen port (default ${DEV_PORT})
  --print-token        Print the dev token to stderr after start
  -h, --help           Show this help

Notes:
  • Data: ${DEV_USER_DATA}
  • Channels / token: ${DEV_HOME}  (never prod ~/.porcelain)
  • Requires a warm build: pnpm build   (if out/main/daemon/server.js is missing)
  • Production is port 43117 / systemd — this command never touches it
  • Not the published package: use \`npx porcelain-daemon@latest serve\` for that

Examples:
  pnpm dev:daemon
  pnpm dev:daemon -- --host --print-token
  pnpm dev:daemon -- --port 43119 --loopback
`

function parseArgs(argv) {
  const opts = {
    host: true, // LAN on by default for Mac ↔ Beelink dev
    tailnet: false,
    port: DEV_PORT,
    printToken: false,
    help: false,
  }
  let i = 0
  while (i < argv.length) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') {
      opts.help = true
      i += 1
      continue
    }
    if (arg === '--host' || arg === '--lan') {
      opts.host = true
      i += 1
      continue
    }
    if (arg === '--loopback' || arg === '--no-host') {
      opts.host = false
      i += 1
      continue
    }
    if (arg === '--tailnet') {
      opts.tailnet = true
      i += 1
      continue
    }
    if (arg === '--print-token') {
      opts.printToken = true
      i += 1
      continue
    }
    if (arg === '--port') {
      const next = argv[i + 1]
      const n = Number(next)
      if (next === undefined || !Number.isInteger(n) || n <= 0 || n > 65535) {
        console.error('[dev:daemon] --port needs an integer 1–65535')
        process.exit(1)
      }
      opts.port = n
      i += 2
      continue
    }
    if (arg.startsWith('--port=')) {
      const n = Number(arg.slice('--port='.length))
      if (!Number.isInteger(n) || n <= 0 || n > 65535) {
        console.error('[dev:daemon] --port needs an integer 1–65535')
        process.exit(1)
      }
      opts.port = n
      i += 1
      continue
    }
    console.error(`[dev:daemon] unknown flag: ${arg}\n\n${HELP}`)
    process.exit(1)
  }
  return opts
}

/** Best-effort PIDs listening on a TCP port (Linux ss). */
function pidsOnPort(port) {
  try {
    const out = execSync(`ss -ltnp "sport = :${port}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const pids = new Set()
    for (const m of out.matchAll(/pid=(\d+)/g)) pids.add(m[1])
    return [...pids]
  } catch {
    return []
  }
}

/** Fail fast with a clear fix when 127.0.0.1:port is taken. */
function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', (err) => {
      if (err.code !== 'EADDRINUSE') {
        reject(err)
        return
      }
      const pids = pidsOnPort(port)
      const who = pids.length > 0 ? pids.join(', ') : 'unknown'
      console.error(`[dev:daemon] port ${port} is already in use (pid ${who})`)
      console.error('  That is usually a leftover dev daemon. Stop it, then retry:')
      if (pids.length > 0) {
        console.error(`    kill ${pids.join(' ')}`)
      }
      console.error(`    # or:  fuser -k ${port}/tcp`)
      console.error('  Leave only one `pnpm dev:daemon` running at a time.')
      process.exit(1)
    })
    probe.listen(port, '127.0.0.1', () => {
      probe.close(() => resolve())
    })
  })
}

function printBanner(opts, token) {
  const lanLine = opts.host
    ? `  host        LAN on  (http://<this-host>.local:${opts.port}/ or numeric LAN IP)`
    : '  host        loopback only'
  const tailnetLine = opts.tailnet ? '  tailnet     on' : '  tailnet     off'
  console.log(`Porcelain DEV stack (do not use prod 43117 / ~/.porcelain for product work)

  port        ${opts.port}
  user data   ${DEV_USER_DATA}
  channels    ${DEV_HOME}  (PORCELAIN_HOME)
  playground  ${DEV_PLAYGROUND}
${lanLine}
${tailnetLine}
  browser     http://127.0.0.1:${opts.port}/
  token file  ${DEV_TOKEN_FILE}
  CLI         pnpm porcelain -- <noun> <verb>

  Rebuild after code changes:  pnpm build && pnpm dev:daemon -- …
`)
  if (opts.printToken) {
    console.error(`[dev:daemon] token  ${token}`)
  } else {
    console.error(`[dev:daemon] token  cat ${DEV_TOKEN_FILE}   (or pass --print-token)`)
  }
}

async function main() {
  // pnpm forwards args after `--`; also accept bare flags when run via node.
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    process.stdout.write(HELP)
    process.exit(0)
  }

  if (!existsSync(serverEntry)) {
    console.error('[dev:daemon] out/main/daemon/server.js missing — run `pnpm build` first')
    process.exit(1)
  }

  mkdirSync(DEV_HOME, { recursive: true })
  mkdirSync(DEV_USER_DATA, { recursive: true })

  if (!existsSync(DEV_PLAYGROUND)) {
    console.error(
      `[dev:daemon] playground missing at ${DEV_PLAYGROUND}\n` +
        '  Create it (git init + a commit) or run from a machine that has it.',
    )
  }

  await assertPortFree(opts.port)

  const token = ensureDevToken()
  // Prefer file on disk if print-token races a concurrent mint (same path either way).
  let tokenOut = token
  try {
    const fromFile = readFileSync(DEV_TOKEN_FILE, 'utf8').trim()
    if (fromFile !== '') tokenOut = fromFile
  } catch {
    // use minted
  }

  printBanner(opts, tokenOut)

  const env = devEnv({
    PORCELAIN_DAEMON_PORT: String(opts.port),
    PORCELAIN_DAEMON_TOKEN: tokenOut,
    PORCELAIN_LAN_BIND: opts.host ? '1' : '',
    PORCELAIN_TAILNET_BIND: opts.tailnet ? '1' : '',
  })

  const child = spawn(process.execPath, [serverEntry], {
    cwd: root,
    env,
    stdio: 'inherit',
  })

  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal)
    process.exit(code ?? 1)
  })

  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => child.kill(sig))
  }
}

main().catch((err) => {
  console.error('[dev:daemon]', err)
  process.exit(1)
})
