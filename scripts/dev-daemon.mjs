#!/usr/bin/env node
/**
 * Start the local-tree daemon on the DEV stack (default port 43118, porcelain-dev data).
 *
 * This is NOT the published `@fabiofiorita/porcelain` npm package — that is for production
 * hosts (`npx @fabiofiorita/porcelain@latest serve`). Day-to-day product work uses this
 * launcher against a built tree (`pnpm build` once, then restart here).
 *
 * Usage:
 *   pnpm dev:daemon
 *   pnpm dev:daemon --host
 *   pnpm dev:daemon --port 43119 --host
 *   pnpm dev:daemon --loopback
 */
import { execFileSync, execSync, spawn } from 'node:child_process'
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  DEV_ADMIN_TOKEN_FILE,
  DEV_HOME,
  DEV_PLAYGROUND,
  DEV_PORT,
  DEV_PROFILE,
  DEV_USER_DATA,
  devEnv,
  ensureDevAdminToken,
  webDevPort,
} from './dev-env.mjs'
import { devAccessStatus, issueDevPairingUrl, waitForDaemon } from './dev-pair.mjs'
import { windowsProcessIdentity } from './windows-process.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const serverEntry = join(root, 'apps', 'desktop', 'out', 'main', 'daemon', 'server.js')

const HELP = `Porcelain DEV daemon — local tree on the isolated dev stack

Usage:
  pnpm dev:daemon [options]

Options:
  --host, --lan        Bind LAN (RFC1918) so other machines can open
                       http://<host>.local:<port>/  (opt-in)
  --loopback, --no-host
                       Loopback only (127.0.0.1) — no LAN share (default)
  --tailnet            Also bind Tailscale (100.64/10) on the same port
  --no-auto-auth       Require a pairing link in the browser (default: auto)
                       Use when the pairing flow itself is what you are testing.
  --port <n>           Listen port (default ${DEV_PORT})
  -h, --help           Show this help

Notes:
  • Data: ${DEV_USER_DATA}
  • Channels / token: ${DEV_HOME}  (never prod ~/.porcelain)
  • Requires a warm build: pnpm build   (if apps/desktop/out/main/daemon/server.js is missing)
  • Uses isolated development data
  • Not the published package: use \`npx @fabiofiorita/porcelain@latest serve\` for that

Examples:
  pnpm dev:daemon
  pnpm dev:daemon --host
  pnpm dev:daemon --port 43119 --loopback
`

export function parseArgs(argv) {
  const opts = {
    host: false,
    tailnet: false,
    autoAuth: true,
    port: DEV_PORT,
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
    if (arg === '--no-auto-auth') {
      opts.autoAuth = false
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

/** Parse PIDs from either Linux `ss` output or macOS `lsof -t` output. */
export function parseListeningPids(output, command) {
  const matches =
    command === 'lsof'
      ? (output.match(/\b\d+\b/g) ?? [])
      : [...output.matchAll(/pid=(\d+)/g)].map((match) => match[1])
  return [...new Set(matches)]
}

/** The platform-specific owner probe; Linux keeps using `ss`, macOS uses `lsof`. */
export function portOwnerProbe(port, platform = process.platform) {
  if (platform === 'darwin') {
    return {
      command: 'lsof',
      args: ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'],
    }
  }
  return {
    command: 'ss',
    args: ['-ltnp', `sport = :${port}`],
  }
}

/** Best-effort PIDs listening on a TCP port (Linux ss, macOS lsof). */
function pidsOnPort(port) {
  const probe = portOwnerProbe(port)
  try {
    const out = execFileSync(probe.command, probe.args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return parseListeningPids(out, probe.command)
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
      console.error(
        process.platform === 'darwin'
          ? `    # or:  lsof -tiTCP:${port} -sTCP:LISTEN | xargs kill`
          : `    # or:  fuser -k ${port}/tcp`,
      )
      console.error('  Leave only one `pnpm dev:daemon` running at a time.')
      process.exit(1)
    })
    probe.listen(port, '127.0.0.1', () => {
      probe.close(() => resolve())
    })
  })
}

function isThisProfileLauncher(pid, started) {
  if (!Number.isInteger(pid) || pid <= 1) return false
  try {
    process.kill(pid, 0)
    if (process.platform === 'win32') {
      const identity = windowsProcessIdentity(pid)
      return identity !== null && identity.started === started
    }
    if (process.platform === 'linux') {
      const cwd = resolve(readlinkSync(`/proc/${pid}/cwd`))
      const command = readFileSync(`/proc/${pid}/cmdline`, 'utf8').replaceAll('\0', ' ')
      return cwd === root && command.includes('scripts/dev-daemon.mjs')
    }
    const command = execSync(`ps -p ${pid} -o command=`, { encoding: 'utf8' })
    const cwd = execSync(`lsof -a -p ${pid} -d cwd -Fn`, { encoding: 'utf8' })
      .split('\n')
      .find((line) => line.startsWith('n'))
      ?.slice(1)
    return command.includes('scripts/dev-daemon.mjs') && resolve(cwd ?? '') === root
  } catch {
    return false
  }
}

function acquireDaemonRecord(path, value) {
  const acquisitionLock = `${path}.acquire-lock`
  try {
    mkdirSync(acquisitionLock)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      throw new Error(
        `daemon record acquisition is already in progress; retry, or remove stale lock ${acquisitionLock}`,
      )
    }
    throw error
  }

  const candidate = `${path}.candidate-${process.pid}-${Date.now()}`
  try {
    const fd = openSync(candidate, 'wx', 0o600)
    try {
      writeFileSync(fd, `${JSON.stringify(value)}\n`)
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }

    for (;;) {
      try {
        linkSync(candidate, path)
        return
      } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error
      }

      try {
        const existing = JSON.parse(readFileSync(path, 'utf8'))
        if (isThisProfileLauncher(existing.pid, existing.started)) {
          throw new Error(
            `profile already has a running dev daemon (pid ${existing.pid}); stop it before launching another`,
          )
        }
        const stalePath = `${path}.stale-${process.pid}-${Date.now()}`
        renameSync(path, stalePath)
        rmSync(stalePath, { force: true })
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('profile already has')) throw error
        // Another launcher may have replaced the stale record first; retry exclusive acquisition.
      }
    }
  } finally {
    rmSync(candidate, { force: true })
    rmSync(acquisitionLock, { recursive: true, force: true })
  }
}

/**
 * Report how a client gets in, once the daemon is listening.
 *
 * With auto-auth on, the browser needs nothing — it collects a real client token from the
 * daemon and every request is still Bearer-gated behind it. Other clients (a simulator, a
 * phone) still pair by link, so print one when this profile has no authorized client yet;
 * otherwise say so rather than minting a link nobody asked for.
 */
async function announcePairing(port, autoAuth) {
  await waitForDaemon(port)
  const authorized = devAccessStatus(port)?.clients?.length
  if (autoAuth && authorized !== undefined && authorized > 0) {
    console.log(`
  auth        auto — open http://127.0.0.1:${port}/ and the browser is in
              ${authorized} client(s) authorized · link for another device: pnpm dev:pair
              Testing the pairing flow itself? pnpm dev:daemon --no-auto-auth
`)
    return
  }
  const url = issueDevPairingUrl({ port })
  console.log(`
  auth        ${autoAuth ? 'auto for the browser; link below for other devices' : 'pairing link required (--no-auto-auth)'}
  pair        ${url}
              One-time link, expires in 15 minutes: open it OR hand it over, never both.
              Another: pnpm dev:pair
`)
}

function printBanner(opts) {
  const profile = DEV_PROFILE.slug ? `worktree ${DEV_PROFILE.slug}` : 'primary checkout'
  const lanLine = opts.host
    ? `  host        LAN on  (http://<this-host>.local:${opts.port}/ or numeric LAN IP)`
    : '  host        loopback only'
  const tailnetLine = opts.tailnet ? '  tailnet     on' : '  tailnet     off'
  console.log(`Porcelain DEV stack · ${profile} (never prod 43117 / ~/.porcelain)

  port        ${opts.port}
  user data   ${DEV_USER_DATA}
  channels    ${DEV_HOME}  (PORCELAIN_HOME)
  playground  ${DEV_PLAYGROUND}
${lanLine}
${tailnetLine}
  browser     http://127.0.0.1:${opts.port}/
  admin file  ${DEV_ADMIN_TOKEN_FILE}
  agent       the Porcelain plugin — MCP tools over POST /mcp
  auth        ${opts.autoAuth ? 'auto (browser needs no pairing)' : 'pairing link required'}
  pair        printed below once the daemon is listening (or \`pnpm dev:pair\`)

  web client   pnpm dev:web  → HMR at http://127.0.0.1:${webDevPort(opts.port)}/ (no rebuild)
  daemon code  pnpm build:daemon, then restart this launcher
`)
}

async function main() {
  // pnpm forwards args after `--`; also accept bare flags when run via node.
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    process.stdout.write(HELP)
    process.exit(0)
  }

  if (!existsSync(serverEntry)) {
    console.error(
      '[dev:daemon] apps/desktop/out/main/daemon/server.js missing — run `pnpm build` first',
    )
    process.exit(1)
  }

  mkdirSync(DEV_HOME, { recursive: true })
  mkdirSync(DEV_USER_DATA, { recursive: true })

  if (!existsSync(DEV_PLAYGROUND)) {
    // Harmless, not an error: DEV_PLAYGROUND only backs the one-time first-boot recents
    // seed (seedDevConfig, apps/daemon/src/dev-config.ts) — every other dev fixture comes
    // from the fleet (`pnpm playground new <shape>`), created on demand, no setup step.
    console.log(
      `[dev:daemon] no playground yet at ${DEV_PLAYGROUND} — recents start empty.\n` +
        '  pnpm playground new dirty   creates a fixture on demand\n' +
        '  pnpm dev:seed everything    creates fixtures AND registers them as projects',
    )
  }

  await assertPortFree(opts.port)

  const token = ensureDevAdminToken()
  let tokenOut = token
  try {
    const fromFile = readFileSync(DEV_ADMIN_TOKEN_FILE, 'utf8').trim()
    if (fromFile !== '') tokenOut = fromFile
  } catch {
    // use minted
  }

  printBanner(opts)

  const daemonRecord = join(DEV_HOME, 'dev-daemon.json')
  acquireDaemonRecord(daemonRecord, {
    pid: process.pid,
    worktreeRoot: root,
    port: opts.port,
    ...(process.platform === 'win32'
      ? { started: windowsProcessIdentity(process.pid)?.started }
      : {}),
  })
  const clearDaemonRecord = () => {
    try {
      const current = JSON.parse(readFileSync(daemonRecord, 'utf8'))
      if (current.pid === process.pid) rmSync(daemonRecord, { force: true })
    } catch {
      // A missing or replaced record belongs to no cleanup action from this launcher.
    }
  }

  const env = devEnv({
    PORCELAIN_DAEMON_PORT: String(opts.port),
    PORCELAIN_ADMIN_TOKEN: tokenOut,
    PORCELAIN_LAN_BIND: opts.host ? '1' : '',
    PORCELAIN_DEV_AUTO_AUTH: opts.autoAuth ? '1' : '0',
    PORCELAIN_TAILNET_BIND: opts.tailnet ? '1' : '',
  })

  const child = spawn(process.execPath, [serverEntry], {
    cwd: root,
    env,
    stdio: 'inherit',
  })

  // Pairing is an announcement, never a gate: a failure here must not take the daemon with it.
  announcePairing(opts.port, opts.autoAuth).catch((error) => {
    console.error(
      `[dev:daemon] could not mint a pairing link (${error instanceof Error ? error.message : String(error)}) — run \`pnpm dev:pair\``,
    )
  })

  child.on('exit', (code, signal) => {
    clearDaemonRecord()
    if (signal) {
      process.removeAllListeners(signal)
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 1)
  })

  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => child.kill(sig))
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('[dev:daemon]', err)
    process.exit(1)
  })
}
