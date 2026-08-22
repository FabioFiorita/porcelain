#!/usr/bin/env node
/** Profile-aware entrypoint for Metro and the Android driving loop. */
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DEV_METRO_PORT, DEV_MOBILE_STATE, DEV_PROFILE } from './dev-env.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

export function mobileLaunch(argv) {
  const [surface = 'metro', ...args] = argv
  const env = {
    ...process.env,
    METRO_PORT: String(DEV_METRO_PORT),
    ANDROID_LOOP_STATE_DIR: join(DEV_MOBILE_STATE, 'android'),
    TMPDIR: join(DEV_MOBILE_STATE, 'tmp'),
  }
  if (surface === 'metro') {
    return {
      command: pnpm,
      args: ['--dir', 'apps/mobile', 'start', '--port', String(DEV_METRO_PORT), ...args],
      env,
    }
  }
  if (surface === 'android') {
    return {
      command: join(root, 'scripts', 'mobile-android-loop.sh'),
      args,
      env,
    }
  }
  throw new Error(`unknown mobile surface ${surface}; expected metro or android`)
}

async function main() {
  const launch = mobileLaunch(process.argv.slice(2))
  mkdirSync(launch.env.TMPDIR, { recursive: true })
  const profile = DEV_PROFILE.slug ? `worktree ${DEV_PROFILE.slug}` : 'primary checkout'
  console.log(
    `Porcelain mobile DEV · ${profile}\n\n  Metro       ${DEV_METRO_PORT}\n  state       ${DEV_MOBILE_STATE}\n`,
  )
  const child = spawn(launch.command, launch.args, { cwd: root, env: launch.env, stdio: 'inherit' })
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
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
    console.error('[dev:mobile]', error)
    process.exit(1)
  })
}
