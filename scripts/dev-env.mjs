#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
/**
 * Shared env for the Porcelain *development* stack.
 * Production (always-on Linux daemon): port 43117 · ~/.local/share/porcelain · ~/.porcelain
 * Primary development checkout: port 43118 · ~/.local/share/porcelain-dev · ~/.porcelain-dev
 * Managed task worktree: port from .porcelain-worktree.json (43200–43999) ·
 *   ~/.local/share/porcelain-dev-worktrees/<slug> · ~/.porcelain-dev-worktrees/<slug> ·
 *   ~/code/porcelain-playgrounds/<slug>
 *
 * Setting PORCELAIN_HOME redirects channels, access state, and CLI install together.
 * Never point a product-work session at the production paths.
 *
 * The launcher is scripts/dev-daemon.mjs (`pnpm dev:daemon -- …`); this module only
 *   builds the env block + token.
 */
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const PRIMARY_PROFILE = {
  slug: null,
  port: 43118,
  userData: join(homedir(), '.local', 'share', 'porcelain-dev'),
  home: join(homedir(), '.porcelain-dev'),
  playground: join(homedir(), 'code', 'porcelain-playground'),
}

function worktreeRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

export function resolveDevProfile() {
  const root = worktreeRoot()
  if (!root) return PRIMARY_PROFILE
  const configPath = join(root, '.porcelain-worktree.json')
  if (!existsSync(configPath)) return PRIMARY_PROFILE

  const config = JSON.parse(readFileSync(configPath, 'utf8'))
  if (
    config.version !== 1 ||
    typeof config.slug !== 'string' ||
    !/^[a-z0-9][a-z0-9-]{1,47}$/.test(config.slug) ||
    config.branch !== `work/${config.slug}` ||
    !Number.isInteger(config.port) ||
    config.port < 43200 ||
    config.port > 43999
  ) {
    throw new Error(`${configPath} is invalid; recreate this managed worktree`)
  }

  return {
    slug: config.slug,
    port: config.port,
    userData: join(homedir(), '.local', 'share', 'porcelain-dev-worktrees', config.slug),
    home: join(homedir(), '.porcelain-dev-worktrees', config.slug),
    playground: join(homedir(), 'code', 'porcelain-playgrounds', config.slug),
  }
}

export const DEV_PROFILE = resolveDevProfile()
export const DEV_PORT = DEV_PROFILE.port
export const DEV_USER_DATA = DEV_PROFILE.userData
export const DEV_HOME = DEV_PROFILE.home
export const DEV_PLAYGROUND = DEV_PROFILE.playground
export const DEV_ADMIN_TOKEN_FILE = join(DEV_HOME, 'admin-token')

/**
 * Metro keeps its conventional 8081 port in the primary checkout. Managed worktrees map their
 * allocated daemon port onto a separate 44000-44799 range, preserving the allocator's uniqueness
 * without colliding with daemon (43200-43999) or web-HMR (53200-53999) listeners.
 */
export function mobileMetroPort(daemonPort = DEV_PORT) {
  if (daemonPort === PRIMARY_PROFILE.port) return 8081
  if (daemonPort >= 43200 && daemonPort <= 43999) return 44000 + (daemonPort - 43200)
  throw new Error(`cannot derive a mobile port from unmanaged daemon port ${daemonPort}`)
}

export const DEV_METRO_PORT = mobileMetroPort(DEV_PORT)
export const DEV_MOBILE_STATE = join(tmpdir(), `porcelain-mobile-${DEV_PROFILE.slug ?? 'primary'}`)

/**
 * The Vite dev server port that pairs with a daemon port. Offsetting by 10000 keeps it
 * unique per profile without a second allocator: dev daemon ports are already unique
 * (43118 primary, 43200–43999 per managed worktree), so 53118 / 53200–53999 are too.
 */
export function webDevPort(daemonPort = DEV_PORT) {
  return daemonPort + 10_000
}

export const DEV_WEB_PORT = webDevPort(DEV_PORT)

/**
 * Mint or load the dev-stack administrator token at ~/.porcelain-dev/admin-token.
 * The daemon entry refuses to auto-read the file when stdin is a TTY (so a
 * bare `node out/main/daemon/server.js` doesn't silently mint); the launcher
 * must pass PORCELAIN_ADMIN_TOKEN via env — same pattern as daemon-cli.js.
 */
export function ensureDevAdminToken() {
  mkdirSync(DEV_HOME, { recursive: true })
  try {
    const existing = readFileSync(DEV_ADMIN_TOKEN_FILE, 'utf8').trim()
    if (existing !== '') return existing
  } catch {
    // absent — mint
  }
  const token = randomBytes(32).toString('hex')
  const tmp = `${DEV_ADMIN_TOKEN_FILE}.tmp`
  writeFileSync(tmp, token, { encoding: 'utf8', mode: 0o600 })
  renameSync(tmp, DEV_ADMIN_TOKEN_FILE)
  return token
}

/**
 * Env block for the dev daemon + CLI.
 * Callers (dev-daemon.mjs) pass LAN/tailnet/port overrides via `extra`.
 */
export function devEnv(extra = {}) {
  const token = process.env.PORCELAIN_ADMIN_TOKEN || ensureDevAdminToken()
  return {
    ...process.env,
    // The daemon gates two dev-only behaviors on this flag: the playground boundary that
    // stops a dev daemon opening the host's real checkouts, and dev seeding. Only the
    // Electron shell used to set it, so `pnpm dev:daemon` — the path every agent takes —
    // ran with the boundary disabled and would happily open this very repository.
    PORCELAIN_DEV: '1',
    PORCELAIN_HOME: DEV_HOME,
    PORCELAIN_USER_DATA: DEV_USER_DATA,
    PORCELAIN_DAEMON_PORT: String(DEV_PORT),
    PORCELAIN_DEV_PLAYGROUND: DEV_PLAYGROUND,
    PORCELAIN_ADMIN_TOKEN_FILE: DEV_ADMIN_TOKEN_FILE,
    PORCELAIN_ADMIN_TOKEN: token,
    PORCELAIN_NO_STDIN_WATCHDOG: '1',
    // Defaults; launcher flags override via `extra`.
    PORCELAIN_LAN_BIND: '1',
    PORCELAIN_TAILNET_BIND: '',
    ...extra,
  }
}

/** Print a short cheat sheet (used by pnpm dev:env). */
export function printDevEnv() {
  const profile = DEV_PROFILE.slug ? `worktree ${DEV_PROFILE.slug}` : 'primary checkout'
  console.log(`Porcelain DEV stack · ${profile} (never prod 43117 / ~/.porcelain)

  port        ${DEV_PORT}
  user data   ${DEV_USER_DATA}
  channels    ${DEV_HOME}  (PORCELAIN_HOME)
  playground  ${DEV_PLAYGROUND}
  Metro       ${DEV_METRO_PORT}
  mobile      ${DEV_MOBILE_STATE}

  start:      pnpm dev:daemon
              pnpm dev:daemon -- --host          # LAN (default)
              pnpm dev:daemon -- --loopback      # this machine only
              pnpm dev:daemon -- --port 43119
              pnpm dev                              # Electron + its profile daemon
  web HMR:    pnpm dev:web                       # http://127.0.0.1:${DEV_WEB_PORT}/ (proxies to the daemon)
  mobile:     pnpm dev:mobile                    # profile Metro (primary 8081; worktrees 44000+)
              pnpm dev:mobile:android preflight  # same port + profile-owned emulator state
  CLI:        pnpm porcelain <noun> <verb>
  agent:      the Porcelain plugin — MCP tools over POST /mcp
  browser:    http://127.0.0.1:${DEV_PORT}/
              http://<host>.local:${DEV_PORT}/   # with --host
  pair:       pnpm dev:pair                          # one-time URL; dev:daemon prints one at boot
  fixtures:   pnpm playground list

  Not the published package — that is:  npx porcelain-daemon@latest serve
  Web client changes:                   pnpm dev:web (HMR, no rebuild)
  Daemon changes:                       pnpm build:daemon && restart pnpm dev:daemon
`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  printDevEnv()
}
