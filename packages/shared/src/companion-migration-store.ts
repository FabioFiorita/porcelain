import { createHash, randomUUID } from 'node:crypto'
import { lstat, mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { projectMigrationLedgerPath } from './project-store'

/**
 * Storage plumbing for the one-time companion migration (#27): the per-Project
 * ledger that makes it idempotent and resumable, plus the small filesystem
 * helpers every conversion shares.
 *
 * The ledger lives with the data it describes — `$PORCELAIN_HOME/projects/<id>/
 * migration.json`, beside `actions.json` and `canvases/` (ADR 0002) — so a
 * Project record carries its own migration history and a deleted checkout can
 * never take it away. It is written after EVERY converted item, not once at the
 * end: a crash halfway through leaves the finished half recorded, and the next
 * run picks up exactly where the last one stopped.
 *
 * NODE-ONLY, like `project-porcelain.ts`: `node:fs` externalizes in a browser
 * bundle and Metro cannot resolve it. Only the daemon and the CLI import this.
 */

export const MIGRATION_LEDGER_VERSION = 1 as const

/** One migrated source, keyed by a stable source key like `board-card:<uuid>`. */
export type MigrationLedgerEntry = {
  /** Content hash of the source at conversion time — diagnostic, never a re-run trigger. */
  fingerprint: string
  /** The id the conversion minted in the new owner (Canvas id, Task id, …). */
  createdId?: string
  migratedAt: string
}

export type MigrationLedger = {
  entries: Record<string, MigrationLedgerEntry>
}

export function emptyMigrationLedger(): MigrationLedger {
  return { entries: {} }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Read one `{ version: 1, value: … }` document, the envelope every daemon-root
 * private store uses (`strict-json-document.ts` in the daemon writes it; the CLI's
 * `canvas-file.ts` and `tasks-file.ts` already hand-write it). `null` means absent
 * or unreadable — the migration treats both as "nothing here yet".
 */
export async function readJsonEnvelope(path: string): Promise<unknown | null> {
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(parsed) || parsed.version !== MIGRATION_LEDGER_VERSION) return null
  return parsed.value ?? null
}

/** Write a `{ version: 1, value }` document through a same-directory temp + rename. */
export async function writeJsonEnvelope(path: string, value: unknown): Promise<void> {
  await writeJsonAtomically(path, { version: MIGRATION_LEDGER_VERSION, value })
}

/** Write plain JSON (no envelope) through a same-directory temp + rename. */
export async function writeJsonAtomically(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${randomUUID()}`
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`)
  await rename(tmp, path)
}

export async function readMigrationLedger(
  homeDir: string,
  projectId: string,
): Promise<MigrationLedger> {
  const value = await readJsonEnvelope(projectMigrationLedgerPath(homeDir, projectId))
  if (!isRecord(value) || !isRecord(value.entries)) return emptyMigrationLedger()
  const entries: Record<string, MigrationLedgerEntry> = {}
  for (const [key, entry] of Object.entries(value.entries)) {
    if (!isRecord(entry)) continue
    if (typeof entry.fingerprint !== 'string' || typeof entry.migratedAt !== 'string') continue
    entries[key] = {
      fingerprint: entry.fingerprint,
      migratedAt: entry.migratedAt,
      ...(typeof entry.createdId === 'string' ? { createdId: entry.createdId } : {}),
    }
  }
  return { entries }
}

export async function writeMigrationLedger(
  homeDir: string,
  projectId: string,
  ledger: MigrationLedger,
): Promise<void> {
  await writeJsonEnvelope(projectMigrationLedgerPath(homeDir, projectId), ledger)
}

/** Stable content hash over the parts that make one source item what it is. */
export function fingerprintOf(parts: readonly string[]): string {
  const hash = createHash('sha256')
  for (const part of parts) {
    hash.update(part, 'utf8')
    hash.update('\0', 'utf8')
  }
  return hash.digest('hex')
}

export async function readTextFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return null
  }
}

export async function readJsonFile(path: string): Promise<unknown | null> {
  const raw = await readTextFile(path)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isDirectory()
  } catch {
    return false
  }
}

/**
 * A file name the migration is willing to copy: a bare name, no directory part,
 * no traversal, no NUL, no dotfile.
 *
 * Legacy evidence directories are agent-written and were never validated on the
 * way in, so a `../../id_rsa` or a `.gitconfig` in there is a real possibility.
 * Names are checked here AND the copier re-checks with `lstat` that the entry is
 * a regular file, because a well-named symlink is the other half of the same
 * escape.
 */
export function isSafeAssetName(name: string): boolean {
  if (name === '' || name === '.' || name === '..') return false
  if (name.startsWith('.')) return false
  return !name.includes('/') && !name.includes('\\') && !name.includes('\0')
}

export type AssetCandidate = { name: string; path: string }

/**
 * Every regular, safely-named file directly inside `dir`, sorted by name.
 *
 * Directories, symlinks (to files or to directories), devices, and sockets are
 * all dropped: a migrated Canvas bundle must contain bytes this Project already
 * owned, never a link that resolves somewhere else once the bundle is read back.
 */
export async function listCopyableAssets(dir: string): Promise<AssetCandidate[]> {
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return []
  }
  const out: AssetCandidate[] = []
  for (const name of names.sort()) {
    if (!isSafeAssetName(name)) continue
    const path = join(dir, name)
    let info: Awaited<ReturnType<typeof lstat>>
    try {
      info = await lstat(path)
    } catch {
      continue
    }
    if (!info.isFile()) continue
    out.push({ name, path })
  }
  return out
}
