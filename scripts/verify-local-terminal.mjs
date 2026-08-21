#!/usr/bin/env node
/**
 * Dual-machine ("This device") terminal verification.
 * Automated coverage (always run):
 *   pnpm exec vitest run src/main/local-terminal-paths.test.ts \
 *     src/renderer/src/lib/local-daemon.test.ts
 *
 * Covers path-key identity (env + repo) and session routing
 * (markLocalTerminal → sessionForTerminal → local daemon).
 *
 * Manual dual-daemon smoke (when local-terminal code changes):
 *   1. Terminal A: PORCELAIN_DAEMON_PORT=43119 PORCELAIN_USER_DATA=/tmp/porcelain-dev-ud
 *      PORCELAIN_HOME=/tmp/porcelain-dev-home pnpm dev:daemon
 *   2. Seed the Mac app's userData remote-daemon.json so a window binds to
 *      that "remote" while the local child still runs.
 *   3. Map a local clone path (folder icon next to + on Terminal).
 *   4. Open "This device" shell → assert PTY cwd is the mapped path and the
 *      session routes via sessionForTerminal (local), not primary.
 *   5. Run a local-targeted Action (where: local); confirm it spawns local.
 * Browser e2e and the local-only native e2e fixture can't cover this path.
 */

import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const result = spawnSync(
  'pnpm',
  [
    '--dir',
    'apps/desktop',
    'exec',
    'vitest',
    'run',
    'src/main/local-terminal-paths.test.ts',
    'src/renderer/src/lib/local-daemon.test.ts',
  ],
  { cwd: root, stdio: 'inherit', env: process.env },
)

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

console.log(`
[verify-local-terminal] unit routing + path-key tests passed.

Manual dual-daemon steps (when changing This-device code) are in the header of:
  scripts/verify-local-terminal.mjs
`)
