import { mkdir, open, readFile, rename, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join } from 'node:path'
import type { z } from 'zod'

export const PERSISTED_FORMAT_VERSION = 1 as const

export type PersistedEnvelope<Value> = { version: 1; value: Value }

export type ReadStrictJsonDocument<Value> =
  | { kind: 'missing' }
  | { kind: 'valid'; value: Value }
  | { kind: 'incompatible-version'; version: number }
  | { kind: 'corrupt'; backupPath: string }
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
    writeChain = run.then(
      () => undefined,
      () => undefined,
    )
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

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      const backupPath = await moveToCorruptBackup(documentPath)
      return { kind: 'corrupt', backupPath }
    }

    const record = parsed as Record<string, unknown>
    if (
      !('version' in record) ||
      typeof record.version !== 'number' ||
      !Number.isFinite(record.version)
    ) {
      const backupPath = await moveToCorruptBackup(documentPath)
      return { kind: 'corrupt', backupPath }
    }

    const version = record.version
    if (version !== PERSISTED_FORMAT_VERSION) {
      return { kind: 'incompatible-version', version }
    }

    const schemaResult = valueSchema.safeParse(record.value)
    if (!schemaResult.success) {
      const backupPath = await moveToCorruptBackup(documentPath)
      return { kind: 'corrupt', backupPath }
    }

    return { kind: 'valid', value: schemaResult.data }
  }

  return { read, write }
}
