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
 * Setting PORCELAIN_HOME redirects channels, token, and CLI install together.
 * Never point a product-work session at the production paths.
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const DEV_PORT = 43118
export const DEV_USER_DATA = join(homedir(), '.local', 'share', 'porcelain-dev')
export const DEV_HOME = join(homedir(), '.porcelain-dev')
export const DEV_PLAYGROUND = join(homedir(), 'code', 'porcelain-playground')

/** Env block for the dev daemon + CLI. Does not enable LAN/tailnet. */
export function devEnv(extra = {}) {
  return {
    ...process.env,
    PORCELAIN_HOME: DEV_HOME,
    PORCELAIN_USER_DATA: DEV_USER_DATA,
    PORCELAIN_DAEMON_PORT: String(DEV_PORT),
    PORCELAIN_DAEMON_TOKEN_FILE: join(DEV_HOME, 'daemon-token'),
    PORCELAIN_NO_STDIN_WATCHDOG: '1',
    // Explicitly clear prod network binds so a shell export can't leak them.
    PORCELAIN_TAILNET_BIND: '',
    PORCELAIN_LAN_BIND: '',
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

  start daemon:  pnpm dev:daemon
  CLI (dev):     pnpm porcelain -- <noun> <verb>
  browser URL:   http://127.0.0.1:${DEV_PORT}/
  agent channel: porcelain CLI only — no MCP
`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  printDevEnv()
}
