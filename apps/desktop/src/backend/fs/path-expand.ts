import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Expand user-facing path forms agents put in markdown (`~/…`, `file://…`) into
 * absolute paths on the daemon host. `readFile` and friends already accept
 * absolute paths; this is the thin front door so Agent-timeline images at
 * `~/.porcelain/loop-evidence/…` resolve the same way as `/tmp/shot.png`.
 *
 * Expansion is daemon-side on purpose: a remote daemon's home is not the Mac
 * client's, and agents always write paths for the machine they run on.
 */
export function expandUserPath(input: string): string {
  const s = input.trim()
  if (s === '') return s
  if (s.startsWith('file:')) {
    try {
      return fileURLToPath(s)
    } catch {
      return s
    }
  }
  if (s === '~') return homedir()
  if (s.startsWith('~/') || s.startsWith('~\\')) {
    return join(homedir(), s.slice(2))
  }
  return s
}
