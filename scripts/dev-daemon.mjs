#!/usr/bin/env node
/**
 * Start the local-tree daemon on the DEV stack (port 43118, porcelain-dev data).
 *
 * Requires `pnpm build` first (or a warm out/main/daemon/server.js).
 * Does not touch the production systemd daemon on 43117.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEV_HOME, DEV_PLAYGROUND, DEV_USER_DATA, devEnv, printDevEnv } from './dev-env.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const serverEntry = join(root, 'out', 'main', 'daemon', 'server.js')

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

printDevEnv()

const child = spawn(process.execPath, [serverEntry], {
  cwd: root,
  env: devEnv(),
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => child.kill(sig))
}
