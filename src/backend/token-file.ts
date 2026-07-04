import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * The daemon's session token, persisted at `~/.porcelain/daemon-token`.
 *
 * Phase 2 (plans/remote-environments.md) replaces the per-app-run token the
 * shell used to mint on every launch with a persistent, shared secret in a
 * fixed home-dir file — so the shell, a re-spawned daemon, and (later) a
 * standalone/remote daemon can all agree on one token without passing it around
 * out-of-band. The shell reads it and hands it to the daemon over env
 * (PORCELAIN_DAEMON_TOKEN, never argv); the daemon reads the same file directly
 * when spawned without the env var.
 *
 * SECURITY: the file is written 0600 (owner read/write only) — it's the secret
 * that gates every daemon request. The write is atomic (tmp + rename, matching
 * the other ~/.porcelain stores) so a concurrent read never sees a half-written
 * token, and the mode is applied on the tmp file before the rename so the token
 * is never briefly world-readable at its final path.
 */
const defaultTokenPath = (): string => join(homedir(), '.porcelain', 'daemon-token')

/**
 * Return the shared daemon token, creating it on first run. Reads the file if it
 * exists and is non-empty (trimmed); otherwise mints a fresh 32-byte hex token,
 * writes it 0600, and returns it. `path` is injectable for tests.
 */
export async function ensureDaemonToken(path = defaultTokenPath()): Promise<string> {
  try {
    const existing = (await readFile(path, 'utf8')).trim()
    if (existing !== '') return existing
  } catch {
    // absent or unreadable — fall through to mint a fresh token
  }
  const token = randomBytes(32).toString('hex')
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  await writeFile(tmp, token, { encoding: 'utf8', mode: 0o600 })
  await rename(tmp, path)
  return token
}
