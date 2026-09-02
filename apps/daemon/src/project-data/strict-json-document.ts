import { mkdir, open, readFile, rename, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join } from 'node:path'
import { z } from 'zod'

export const PERSISTED_FORMAT_VERSION = 1 as const

export type PersistedEnvelope<Value> = { version: 1; value: Value }

/**
 * The persisted envelope, parsed rather than hand-narrowed.
 *
 * This adapter owns its file format — the envelope is persistence, not wire, so contracts
 * never see it. `version` is read as a plain finite number and compared afterwards so an
 * envelope written by a FUTURE format still reports `incompatible-version` (and keeps its
 * file) instead of being backed up as corrupt. `value` stays optional `unknown` here: the
 * caller's `valueSchema` is the only thing allowed to describe it, including whether an
 * absent value is acceptable.
 */
const persistedEnvelopeSchema = z.object({
  // Finite only: NaN/±Infinity must not be misread as a future format version.
  version: z.number().finite(),
  value: z.unknown().optional(),
})

export type ReadStrictJsonDocument<Value> =
  | { kind: 'missing' }
  | { kind: 'valid'; value: Value }
  | { kind: 'incompatible-version'; version: number }
  | { kind: 'corrupt'; backupPath: string }
  | { kind: 'schema-mismatch'; value: unknown }
  | { kind: 'too-large'; byteLength: number; maxBytes: number }

export interface StrictJsonDocumentOptions<Value> {
  path: string
  valueSchema: z.ZodType<Value>
  maxBytes: number
}

export interface StrictJsonDocument<Value> {
  read(): Promise<ReadStrictJsonDocument<Value>>
  write(value: Value): Promise<void>
}

/** Monotonic in-process counter so concurrent documents never share a temp path. */
let tempNameCounter = 0

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error
}

function isEnoent(error: unknown): boolean {
  return isNodeError(error) && error.code === 'ENOENT'
}

function requireAbsolutePath(path: string): void {
  if (!isAbsolute(path)) {
    throw new Error(`strict-json-document path must be absolute, got: ${path}`)
  }
}

function requirePositiveSafeIntegerMaxBytes(maxBytes: number): void {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error(
      `strict-json-document maxBytes must be a positive safe integer, got: ${String(maxBytes)}`,
    )
  }
}

function encodeEnvelope<Value>(value: Value): string {
  return `${JSON.stringify({ version: PERSISTED_FORMAT_VERSION, value }, null, 2)}\n`
}

function corruptTimestamp(): string {
  return new Date().toISOString().replaceAll(':', '-')
}

/**
 * Move `sourcePath` to an exclusive corruption backup. Base name is
 * `${path}.corrupt-<UTC ISO with colons → dashes>`; on collision append `-1`, `-2`, …
 * Never overwrites an existing backup.
 */
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

async function fsyncFileHandle(handle: Awaited<ReturnType<typeof open>>): Promise<void> {
  await handle.sync()
}

async function fsyncPath(targetPath: string): Promise<void> {
  // Windows does not let Node open a directory handle with `open(path, 'r')`; it fails
  // with EPERM. The temp file itself was flushed before rename, so retain that durability
  // boundary and skip only the POSIX directory-entry flush that Windows cannot express.
  if (process.platform === 'win32') return
  const handle = await open(targetPath, 'r')
  try {
    await fsyncFileHandle(handle)
  } finally {
    await handle.close()
  }
}

export function createStrictJsonDocument<Value>(
  options: StrictJsonDocumentOptions<Value>,
): StrictJsonDocument<Value> {
  requireAbsolutePath(options.path)
  requirePositiveSafeIntegerMaxBytes(options.maxBytes)

  const documentPath = options.path
  const { valueSchema, maxBytes } = options
  const parentDirectory = dirname(documentPath)

  // FIFO write serialization: rejections do not block the next write.
  let writeChain: Promise<void> = Promise.resolve()

  async function performWrite(value: Value): Promise<void> {
    await mkdir(parentDirectory, { recursive: true })
    tempNameCounter += 1
    const tmpPath = join(parentDirectory, `.tmp-${tempNameCounter}`)
    const body = encodeEnvelope(value)

    const handle = await open(tmpPath, 'wx', 0o600)
    try {
      await handle.writeFile(body, 'utf8')
      await fsyncFileHandle(handle)
    } finally {
      await handle.close()
    }

    await rename(tmpPath, documentPath)
    await fsyncPath(parentDirectory)
  }

  function write(value: Value): Promise<void> {
    const run = writeChain.then(() => performWrite(value))
    // The caller owns `run`'s rejection; this tail only keeps the FIFO chain alive.
    writeChain = Promise.allSettled([run]).then(() => undefined)
    return run
  }

  async function read(): Promise<ReadStrictJsonDocument<Value>> {
    let fileStat: Awaited<ReturnType<typeof stat>>
    try {
      fileStat = await stat(documentPath)
    } catch (error) {
      if (isEnoent(error)) return { kind: 'missing' }
      throw error
    }

    if (fileStat.size > maxBytes) {
      return { kind: 'too-large', byteLength: fileStat.size, maxBytes }
    }

    let raw: string
    try {
      raw = await readFile(documentPath, 'utf8')
    } catch (error) {
      if (isEnoent(error)) return { kind: 'missing' }
      throw error
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      const backupPath = await moveToCorruptBackup(documentPath)
      return { kind: 'corrupt', backupPath }
    }

    const envelope = persistedEnvelopeSchema.safeParse(parsed)
    if (!envelope.success) {
      const backupPath = await moveToCorruptBackup(documentPath)
      return { kind: 'corrupt', backupPath }
    }

    const { version } = envelope.data
    if (version !== PERSISTED_FORMAT_VERSION) {
      return { kind: 'incompatible-version', version }
    }

    // A well-formed envelope whose value no longer matches valueSchema is an old
    // shape, not garbage — leave the file in place so a caller can migrate it
    // instead of it being quarantined and lost (moveToCorruptBackup is reserved
    // for JSON/envelope failures above, which no migration can recover from).
    const schemaResult = valueSchema.safeParse(envelope.data.value)
    if (!schemaResult.success) {
      return { kind: 'schema-mismatch', value: envelope.data.value }
    }

    return { kind: 'valid', value: schemaResult.data }
  }

  return { read, write }
}
