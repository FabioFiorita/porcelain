#!/usr/bin/env node
/**
 * Run the bundled porcelain CLI against this checkout's isolated DEV channel dir.
 * Primary uses ~/.porcelain-dev; managed worktrees resolve their own profile.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { devEnv } from './dev-env.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cli = join(root, 'apps', 'desktop', 'out', 'main', 'cli', 'porcelain.js')

if (!existsSync(cli)) {
  console.error(
    '[porcelain] apps/desktop/out/main/cli/porcelain.js missing — run `pnpm build` first',
  )
  process.exit(1)
}

const args = process.argv.slice(2)
const child = spawn(process.execPath, [cli, ...args], {
  cwd: process.cwd(),
  env: devEnv(),
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
