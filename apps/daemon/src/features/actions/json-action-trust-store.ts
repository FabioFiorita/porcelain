import { createHash } from 'node:crypto'
import { mkdir, open, readFile, rename, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import { porcelainHomePath } from '@porcelain/shared/porcelain-home'
import type { ActionsStoreResult, ActionTrustStore } from './actions-ports'

export const ACTION_TRUST_FILE_MAX_BYTES = 512 * 1024
export const ACTION_TRUST_FILE_VERSION = 1 as const

/** `projects` is keyed by the stable Project id, not a checkout path. */
export type ActionTrustFileV1 = {
  version: typeof ACTION_TRUST_FILE_VERSION
  projects: Record<string, string[]>
}

/**
 * The command text is what runs, so the command text is what gets trusted. A
 * retitled action keeps its trust; an edited command loses it.
 */
export function commandFingerprint(command: string): string {
  return createHash('sha256').update(command).digest('hex').slice(0, 32)
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error
}

function isEnoent(error: unknown): boolean {
  return isNodeError(error) && error.code === 'ENOENT'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function trustFilePath(): string {
  return process.env.PORCELAIN_ACTION_TRUST_FILE ?? porcelainHomePath('action-trust.json')
}

function emptyTrustDoc(): ActionTrustFileV1 {
  return { version: ACTION_TRUST_FILE_VERSION, projects: {} }
}

function corruptTimestamp(): string {
  return new Date().toISOString().replaceAll(':', '-')
}

async function moveToCorruptBackup(sourcePath: string): Promise<string> {
  const stamp = corruptTimestamp()
  let attempt = 0
  for (;;) {
    const backupPath =
      attempt === 0 ? `${sourcePath}.corrupt-${stamp}` : `${sourcePath}.corrupt-${stamp}-${attempt}`
    try {
      await stat(backupPath)
      attempt += 1
      continue
    } catch (error) {
      if (!isEnoent(error)) throw error
    }
    await rename(sourcePath, backupPath)
    return backupPath
  }
}

function parseTrustDocument(value: unknown): ActionTrustFileV1 {
  if (!isRecord(value)) {
    throw new Error('malformed')
  }
  for (const key of Object.keys(value)) {
    if (key !== 'version' && key !== 'projects') {
      throw new Error('malformed')
    }
  }
  if (
    !('version' in value) ||
    typeof value.version !== 'number' ||
    !Number.isFinite(value.version)
  ) {
    throw new Error('malformed')
  }
  if (value.version !== ACTION_TRUST_FILE_VERSION) {
    throw new Error('incompatible-version')
  }
  if (!isRecord(value.projects)) {
    throw new Error('malformed')
  }
  const projects: Record<string, string[]> = {}
  for (const [projectId, fingerprints] of Object.entries(value.projects)) {
    if (!Array.isArray(fingerprints)) throw new Error('malformed')
    const next: string[] = []
    for (const fingerprint of fingerprints) {
      if (typeof fingerprint !== 'string' || fingerprint.length === 0) {
        throw new Error('malformed')
      }
      next.push(fingerprint)
    }
    projects[projectId] = next
  }
  return { version: ACTION_TRUST_FILE_VERSION, projects }
}

function serializeTrustDocument(value: ActionTrustFileV1): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

async function fsyncPath(targetPath: string): Promise<void> {
  // Windows cannot open directory handles through Node. The temp file has
  // already been synced, so only the POSIX directory-entry flush is skipped.
  if (process.platform === 'win32') return
  const handle = await open(targetPath, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

type TrustReadOutcome =
  | { status: 'ok'; value: ActionTrustFileV1 }
  | { status: 'missing' }
  | { status: 'unusable-backed-up' }
  | { status: 'oversize' }
  | { status: 'unavailable' }

/**
 * Machine-local action trust: strict v1 home document keyed by stable Project id.
 * Fail closed on trust reads (empty set) so listing still works after corruption.
 */
export function createJsonActionTrustStore(
  options: { maxBytes?: number; path?: string } = {},
): ActionTrustStore {
  const maxBytes = options.maxBytes ?? ACTION_TRUST_FILE_MAX_BYTES
  let chain: Promise<void> = Promise.resolve()

  function resolvePath(): string {
    return options.path ?? trustFilePath()
  }

  async function readDocument(): Promise<TrustReadOutcome> {
    const path = resolvePath()
    let fileStat: Awaited<ReturnType<typeof stat>>
    try {
      fileStat = await stat(path)
    } catch (error) {
      if (isEnoent(error)) return { status: 'missing' }
      return { status: 'unavailable' }
    }

    if (fileStat.size > maxBytes) {
      console.error(
        `porcelain: ${path} is ${fileStat.size} bytes (> ${maxBytes}); action trust oversized`,
      )
      return { status: 'oversize' }
    }

    let raw: string
    try {
      raw = await readFile(path, 'utf8')
    } catch (error) {
      if (isEnoent(error)) return { status: 'missing' }
      return { status: 'unavailable' }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      try {
        await moveToCorruptBackup(path)
      } catch {
        return { status: 'unavailable' }
      }
      return { status: 'unusable-backed-up' }
    }

    // Unversioned top-level record shape is rejected without coercion.
    try {
      return { status: 'ok', value: parseTrustDocument(parsed) }
    } catch {
      try {
        await moveToCorruptBackup(path)
      } catch {
        return { status: 'unavailable' }
      }
      return { status: 'unusable-backed-up' }
    }
  }

  async function writeDocument(file: ActionTrustFileV1): Promise<ActionsStoreResult<void>> {
    const path = resolvePath()
    try {
      const parent = dirname(path)
      await mkdir(parent, { recursive: true })
      const tmpPath = `${path}.tmp`
      const body = serializeTrustDocument(file)
      const handle = await open(tmpPath, 'w', 0o600)
      try {
        await handle.writeFile(body, 'utf8')
        await handle.sync()
      } finally {
        await handle.close()
      }
      await rename(tmpPath, path)
      await fsyncPath(parent)
      return { ok: true, value: undefined }
    } catch {
      return { ok: false, error: { code: 'actions.unavailable' } }
    }
  }

  function serialize(run: () => Promise<void>): Promise<void> {
    const next = chain.then(run, run)
    chain = Promise.allSettled([next]).then(() => undefined)
    return next
  }

  return {
    async readFingerprints(projectId) {
      let outcome: ActionsStoreResult<ReadonlySet<string>> = {
        ok: true,
        value: new Set(),
      }
      await serialize(async () => {
        const read = await readDocument()
        if (read.status === 'ok') {
          outcome = {
            ok: true,
            value: new Set(read.value.projects[projectId] ?? []),
          }
          return
        }
        // missing / unusable / oversize → empty set success (fail closed on trust)
        if (
          read.status === 'missing' ||
          read.status === 'unusable-backed-up' ||
          read.status === 'oversize'
        ) {
          outcome = { ok: true, value: new Set() }
          return
        }
        outcome = { ok: false, error: { code: 'actions.unavailable' } }
      })
      return outcome
    },

    async trustCommands(projectId, commands) {
      let outcome: ActionsStoreResult<void> = {
        ok: false,
        error: { code: 'actions.unavailable' },
      }
      await serialize(async () => {
        const read = await readDocument()
        if (read.status === 'oversize' || read.status === 'unusable-backed-up') {
          outcome = { ok: false, error: { code: 'actions.unavailable' } }
          return
        }
        if (read.status === 'unavailable') {
          outcome = { ok: false, error: { code: 'actions.unavailable' } }
          return
        }

        const current = read.status === 'ok' ? read.value : emptyTrustDoc()
        const existing = new Set(current.projects[projectId] ?? [])
        for (const command of commands) {
          existing.add(commandFingerprint(command))
        }
        const next: ActionTrustFileV1 = {
          version: ACTION_TRUST_FILE_VERSION,
          projects: {
            ...current.projects,
            [projectId]: [...existing],
          },
        }
        outcome = await writeDocument(next)
      })
      return outcome
    },
  }
}
