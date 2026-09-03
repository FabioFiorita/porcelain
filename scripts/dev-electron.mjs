#!/usr/bin/env node
/**
 * Start the Electron development client on the same isolated profile as
 * `pnpm dev:daemon`.
 *
 * Keeping this launcher at the workspace root matters: `scripts/dev-env.mjs`
 * resolves the primary checkout or the managed/adopted worktree from cwd, and
 * the resulting PORCELAIN_* block must reach both Electron and its daemon child.
 * The package-local command remains available for low-level Electron tests, but
 * product development should use `pnpm dev` so it cannot silently fall back to
 * the platform-default (and potentially production) profile.
 */
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { devEnv, DEV_PROFILE, DEV_PORT, DEV_USER_DATA } from './dev-env.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Return the child command and complete profile env without starting it. */
export function electronLaunch(args = []) {
  const pnpmArgs = ['--dir', 'apps/desktop', 'dev', ...args]
  // Node 24 no longer executes .cmd shims directly on Windows (`spawn EINVAL`). Route the
  // pnpm shim through cmd.exe explicitly; keeping every argument separate preserves normal
  // quoting and avoids building an injectable command string.
  const command = process.platform === 'win32' ? 'cmd.exe' : 'pnpm'
  return {
    command,
    args: process.platform === 'win32' ? ['/d', '/s', '/c', 'pnpm.cmd', ...pnpmArgs] : pnpmArgs,
    env: devEnv(),
  }
}

function printBanner() {
  const profile = DEV_PROFILE.slug ? `worktree ${DEV_PROFILE.slug}` : 'primary checkout'
  console.log(`Porcelain DEV Electron · ${profile}

  daemon      http://127.0.0.1:${DEV_PORT}/ (Electron starts its own daemon)
  user data   ${DEV_USER_DATA}  (Electron profile + single-instance lock)
  channels    ${DEV_PROFILE.home}  (PORCELAIN_HOME)
  playground  ${DEV_PROFILE.playground}

  This uses the same profile as pnpm dev:daemon. Do not run both for one profile.
`)
}

async function main() {
  const launch = electronLaunch(process.argv.slice(2))
  printBanner()
  const child = spawn(launch.command, launch.args, {
    cwd: root,
    env: launch.env,
    stdio: 'inherit',
  })

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => child.kill(signal))
  }

  child.on('exit', (code, signal) => {
    if (signal) {
      process.removeAllListeners(signal)
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 1)
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('[dev:electron]', error)
    process.exit(1)
  })
}
