#!/usr/bin/env node
/**
 * Pairing for the Porcelain DEV stack.
 *
 * The daemon's own pairing path is `porcelain-host.js access issue`, which already prints a
 * complete one-time URL. This module drives that exact command with the dev profile's env
 * so the launcher can hand over a ready-to-open URL instead of a command to run next —
 * and so nobody plants an admin token into `localStorage` by hand again.
 *
 * A pairing URL is a one-time credential. Whoever opens it consumes it: hand it over or
 * use it, never both.
 *
 * Usage:
 *   pnpm dev:pair                 # mint against this profile's daemon
 *   pnpm dev:pair -- --name iPad  # label the device
 */
import { execFileSync } from 'node:child_process'
import { connect } from 'node:net'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DEV_PORT, devEnv } from './dev-env.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const hostLauncher = join(root, 'scripts', 'porcelain-host.js')

const loopbackUrl = (port) => `http://127.0.0.1:${port}`

/**
 * `porcelain-host.js` ships inside the published package, where its dependencies sit beside it.
 * Run from the monorepo it resolves nothing (`Cannot find module '@trpc/client'`), because
 * pnpm keeps those under the workspace packages that declare them. Lend it that resolution
 * root rather than teaching the shipped host launcher about the checkout's layout.
 */
const HOST_RESOLUTION_ROOTS = [
  join(root, 'apps', 'desktop', 'node_modules'),
  join(root, 'apps', 'daemon', 'node_modules'),
]

function runDaemonCli(args, port) {
  const nodePath = [...HOST_RESOLUTION_ROOTS, process.env.NODE_PATH]
    .filter((entry) => entry !== undefined && entry !== '')
    .join(delimiter)
  return execFileSync(process.execPath, [hostLauncher, ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: devEnv({ PORCELAIN_DAEMON_PORT: String(port), NODE_PATH: nodePath }),
  }).trim()
}

/** Resolve once the daemon's loopback listener accepts connections, or throw on timeout. */
export async function waitForDaemon(port, timeoutMs = 30_000, pollMs = 150) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const reachable = await new Promise((settle) => {
      const socket = connect({ port, host: '127.0.0.1' })
      const done = (value) => {
        socket.destroy()
        settle(value)
      }
      socket.once('connect', () => done(true))
      socket.once('error', () => done(false))
      socket.setTimeout(pollMs, () => done(false))
    })
    if (reachable) return
    if (Date.now() >= deadline)
      throw new Error(`daemon did not open port ${port} in ${timeoutMs}ms`)
    await new Promise((wake) => setTimeout(wake, pollMs))
  }
}

/** Parsed `access list` for this profile's daemon, or null when it cannot be read. */
export function devAccessStatus(port = DEV_PORT) {
  try {
    return JSON.parse(runDaemonCli(['access', 'list', '--daemon-url', loopbackUrl(port)], port))
  } catch {
    return null
  }
}

/**
 * Mint a one-time pairing URL. With no explicit base URL the daemon picks the widest
 * enabled endpoint (LAN, then tailnet, then Cloudflare); a loopback-only daemon has none to
 * suggest, so fall back to the loopback origin rather than failing the launch.
 */
export function issueDevPairingUrl({ port = DEV_PORT, label = 'Dev browser', baseUrl } = {}) {
  const base = ['access', 'issue', '--name', label, '--daemon-url', loopbackUrl(port)]
  if (baseUrl !== undefined) return runDaemonCli([...base, '--base-url', baseUrl], port)
  try {
    return runDaemonCli(base, port)
  } catch (error) {
    // Retry ONLY the one failure loopback can answer. A blanket retry turned a missing
    // module into a second identical failure and hid the real cause behind it.
    const reason = `${error?.stderr ?? ''}${error?.message ?? ''}`
    if (!reason.includes('no reachable endpoint is enabled')) throw error
    return runDaemonCli([...base, '--base-url', loopbackUrl(port)], port)
  }
}

function parseArgs(argv) {
  const options = { label: 'Dev browser', port: DEV_PORT, baseUrl: undefined }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const value = argv[i + 1]
    if (arg === '--name' || arg === '--base-url' || arg === '--port') {
      if (value === undefined) throw new Error(`${arg} requires a value`)
      if (arg === '--name') options.label = value
      else if (arg === '--base-url') options.baseUrl = value
      else options.port = Number(value)
      i += 1
      continue
    }
    throw new Error(`unknown flag: ${arg}`)
  }
  return options
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseArgs(process.argv.slice(2))
    process.stdout.write(`${issueDevPairingUrl(options)}\n`)
  } catch (error) {
    console.error(`[dev:pair] ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}
