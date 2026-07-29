#!/usr/bin/env node
/**
 * Shared env for the Porcelain *development* stack.
 *
 * Production (always-on work daemon on Linux):
 *   port 43117 · ~/.local/share/porcelain · ~/.porcelain
 *
 * Development (agents building Porcelain):
 *   port 43118 · ~/.local/share/porcelain-dev · ~/.porcelain-dev
 *
 * Setting PORCELAIN_HOME redirects channels, access state, and CLI install together.
 * Never point a product-work session at the production paths.
 *
 * The launcher is scripts/dev-daemon.mjs (`pnpm dev:daemon -- …`). This module
 * only builds the env block + token; flags live on the launcher.
 */
import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const DEV_PORT = 43118
export const DEV_USER_DATA = join(homedir(), '.local', 'share', 'porcelain-dev')
export const DEV_HOME = join(homedir(), '.porcelain-dev')
export const DEV_PLAYGROUND = join(homedir(), 'code', 'porcelain-playground')
export const DEV_ADMIN_TOKEN_FILE = join(DEV_HOME, 'admin-token')

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
    PORCELAIN_HOME: DEV_HOME,
    PORCELAIN_USER_DATA: DEV_USER_DATA,
    PORCELAIN_DAEMON_PORT: String(DEV_PORT),
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
  console.log(`Porcelain DEV stack (do not use prod 43117 / ~/.porcelain for product work)

  port        ${DEV_PORT}
  user data   ${DEV_USER_DATA}
  channels    ${DEV_HOME}  (PORCELAIN_HOME)
  playground  ${DEV_PLAYGROUND}

  start:      pnpm dev:daemon
              pnpm dev:daemon -- --host          # LAN (default)
              pnpm dev:daemon -- --loopback      # this machine only
              pnpm dev:daemon -- --port 43119
  CLI:        pnpm porcelain <noun> <verb>
  browser:    http://127.0.0.1:${DEV_PORT}/
              http://<host>.local:${DEV_PORT}/   # with --host
  pair:       node scripts/daemon-cli.js access issue --name "Dev browser" --base-url http://127.0.0.1:${DEV_PORT}

  Not the published package — that is:  npx porcelain-daemon@latest serve
  Rebuild after code changes:           pnpm build && pnpm dev:daemon
`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  printDevEnv()
}
