import { randomBytes } from 'node:crypto'
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname } from 'node:path'
import { porcelainHomePath } from '@shared/porcelain-home'

/**
 * The host administrator credential, persisted at `~/.porcelain/admin-token`.
 *
 * This is intentionally a new secret instead of reusing the retired shared
 * `daemon-token`: existing remote clients may know that value. Only the local
 * Electron shell and host CLI receive the administrator credential. Ordinary
 * devices exchange one-time pairing grants for individual client tokens.
 */
const adminTokenPath = (): string =>
  process.env.PORCELAIN_ADMIN_TOKEN_FILE ?? porcelainHomePath('admin-token')

/**
 * Tilde-shorten when under this host's home so diagnostics show the active
 * production or development home rather than a hardcoded path.
 */
export function displayAdminTokenPath(path = adminTokenPath()): string {
  const home = homedir()
  if (home !== '' && (path === home || path.startsWith(`${home}/`))) {
    return `~${path.slice(home.length)}`
  }
  return path
}

/**
 * Return the host administrator token, creating it on first run. Reads the file
 * if it is non-empty; otherwise mints a fresh 32-byte hex token and writes it
 * 0600. `path` is injectable for tests.
 */
async function writeToken(path: string, token: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  await writeFile(tmp, token, { encoding: 'utf8', mode: 0o600 })
  await rename(tmp, path)
}

export async function ensureAdminToken(path = adminTokenPath()): Promise<string> {
  try {
    const existing = (await readFile(path, 'utf8')).trim()
    if (existing !== '') {
      await chmod(path, 0o600)
      return existing
    }
  } catch {
    // absent or unreadable — fall through to mint a fresh token
  }
  const token = randomBytes(32).toString('hex')
  await writeToken(path, token)
  return token
}
