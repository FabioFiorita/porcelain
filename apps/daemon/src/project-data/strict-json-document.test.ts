// @vitest-environment node
import { chmod, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { withTemporaryDirectory } from '../testing/temporary-directory'
import {
  createStrictJsonDocument,
  PERSISTED_FORMAT_VERSION,
  type ReadStrictJsonDocument,
} from './strict-json-document'

const valueSchema = z.object({
  name: z.string(),
  count: z.number().int(),
})

type SampleValue = z.infer<typeof valueSchema>

function documentAt(path: string, maxBytes = 64 * 1024) {
  return createStrictJsonDocument({ path, valueSchema, maxBytes })
}

async function listTmpFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory)
  return entries.filter((entry) => entry.startsWith('.tmp-'))
}

describe('createStrictJsonDocument', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects non-absolute path and non-positive-safe-integer maxBytes', async () => {
    await withTemporaryDirectory('porcelain-dat-001-ctor-', async (directory) => {
      const abs = join(directory, 'doc.json')
      expect(() =>
        createStrictJsonDocument({ path: 'relative.json', valueSchema, maxBytes: 100 }),
      ).toThrow(/absolute/)
      expect(() => createStrictJsonDocument({ path: abs, valueSchema, maxBytes: 0 })).toThrow(
        /positive safe integer/,
      )
      expect(() => createStrictJsonDocument({ path: abs, valueSchema, maxBytes: -1 })).toThrow(
        /positive safe integer/,
      )
      expect(() => createStrictJsonDocument({ path: abs, valueSchema, maxBytes: 1.5 })).toThrow(
        /positive safe integer/,
      )
      expect(() =>
        createStrictJsonDocument({
          path: abs,
          valueSchema,
          maxBytes: Number.MAX_SAFE_INTEGER + 1,
        }),
      ).toThrow(/positive safe integer/)
    })
  })

  it('returns missing only when the document path does not exist', async () => {
    await withTemporaryDirectory('porcelain-dat-001-missing-', async (directory) => {
      const path = join(directory, 'absent.json')
      const doc = documentAt(path)
      const result: ReadStrictJsonDocument<SampleValue> = await doc.read()
      expect(result).toEqual({ kind: 'missing' })
    })
  })

  it('writes a strict v1 envelope and reads it back as valid', async () => {
    await withTemporaryDirectory('porcelain-dat-001-valid-', async (directory) => {
      const path = join(directory, 'nested', 'doc.json')
      const doc = documentAt(path)
      const value: SampleValue = { name: 'alpha', count: 3 }

      await doc.write(value)

      const result = await doc.read()
      expect(result).toEqual({ kind: 'valid', value })

      const raw = await readFile(path, 'utf8')
      const parsed = JSON.parse(raw) as { version: number; value: SampleValue }
      expect(parsed.version).toBe(PERSISTED_FORMAT_VERSION)
      expect(parsed.version).toBe(1)
      expect(parsed.value).toEqual(value)
      expect(raw.endsWith('\n')).toBe(true)
      expect(raw).toBe(`${JSON.stringify({ version: 1, value }, null, 2)}\n`)
      expect(await listTmpFiles(directory)).toEqual([])
      expect(await listTmpFiles(join(directory, 'nested'))).toEqual([])
      expect((await stat(path)).mode & 0o777).toBe(0o600)
    })
  })

  it('returns too-large before decoding and leaves the source untouched', async () => {
    await withTemporaryDirectory('porcelain-dat-001-large-', async (directory) => {
      const path = join(directory, 'big.json')
      const payload = 'x'.repeat(200)
      await writeFile(path, payload, 'utf8')
      const maxBytes = 50
      const doc = documentAt(path, maxBytes)

      const result = await doc.read()
      expect(result).toEqual({
        kind: 'too-large',
        byteLength: Buffer.byteLength(payload, 'utf8'),
        maxBytes,
      })
      expect(await readFile(path, 'utf8')).toBe(payload)
    })
  })

  it('renames malformed JSON to an exclusive corrupt backup preserving original bytes', async () => {
    await withTemporaryDirectory('porcelain-dat-001-malformed-', async (directory) => {
      const path = join(directory, 'doc.json')
      const original = '{ not json at all'
      await writeFile(path, original, 'utf8')
      const doc = documentAt(path)

      const result = await doc.read()
      expect(result.kind).toBe('corrupt')
      if (result.kind !== 'corrupt') return

      await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' })
      expect(result.backupPath.startsWith(`${path}.corrupt-`)).toBe(true)
      expect(await readFile(result.backupPath, 'utf8')).toBe(original)
    })
  })

  it('reports a version-1 envelope whose value the caller schema rejects as schema-mismatch, leaving the file in place', async () => {
    await withTemporaryDirectory('porcelain-dat-001-invalid-v1-', async (directory) => {
      const path = join(directory, 'doc.json')
      const value = { name: 99, count: 'nope' }
      const original = `${JSON.stringify({ version: 1, value }, null, 2)}\n`
      await writeFile(path, original, 'utf8')
      const doc = documentAt(path)

      const result = await doc.read()
      expect(result).toEqual({ kind: 'schema-mismatch', value })
      expect(await readFile(path, 'utf8')).toBe(original)
    })
  })

  it('preserves unknown numeric versions in place as incompatible-version', async () => {
    await withTemporaryDirectory('porcelain-dat-001-unknown-ver-', async (directory) => {
      const path = join(directory, 'doc.json')
      const original = `${JSON.stringify({ version: 99, value: { name: 'x', count: 1 } }, null, 2)}\n`
      await writeFile(path, original, 'utf8')
      const doc = documentAt(path)

      const result = await doc.read()
      expect(result).toEqual({ kind: 'incompatible-version', version: 99 })
      expect(await readFile(path, 'utf8')).toBe(original)
    })
  })

  it('never treats unversioned JSON as v1 — backs it up as corrupt', async () => {
    await withTemporaryDirectory('porcelain-dat-001-unversioned-', async (directory) => {
      const path = join(directory, 'legacy.json')
      const original = `${JSON.stringify({ name: 'legacy', count: 1 }, null, 2)}\n`
      await writeFile(path, original, 'utf8')
      const doc = documentAt(path)

      const result = await doc.read()
      expect(result.kind).toBe('corrupt')
      if (result.kind !== 'corrupt') return
      await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' })
      expect(await readFile(result.backupPath, 'utf8')).toBe(original)
    })
  })

  it('allocates exclusive corrupt backups on timestamp collision without overwrite', async () => {
    await withTemporaryDirectory('porcelain-dat-001-backup-collision-', async (directory) => {
      const path = join(directory, 'doc.json')
      const doc = documentAt(path)
      const original = 'not-json-collision'
      await writeFile(path, original, 'utf8')

      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-08-10T12:00:00.000Z'))
      try {
        const liveStamp = new Date().toISOString().replaceAll(':', '-')
        const livePrimary = `${path}.corrupt-${liveStamp}`
        await writeFile(livePrimary, 'blocker', 'utf8')
        // Also occupy -1 so allocation walks to -2.
        await writeFile(`${livePrimary}-1`, 'blocker-1', 'utf8')

        const result = await doc.read()
        expect(result.kind).toBe('corrupt')
        if (result.kind !== 'corrupt') return

        expect(result.backupPath).toBe(`${livePrimary}-2`)
        expect(await readFile(result.backupPath, 'utf8')).toBe(original)
        expect(await readFile(livePrimary, 'utf8')).toBe('blocker')
        expect(await readFile(`${livePrimary}-1`, 'utf8')).toBe('blocker-1')
        await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' })
      } finally {
        vi.useRealTimers()
      }
    })
  })

  it('serializes concurrent writes in FIFO order on a real filesystem', async () => {
    await withTemporaryDirectory('porcelain-dat-001-fifo-', async (directory) => {
      const path = join(directory, 'doc.json')
      const doc = documentAt(path)

      const writes = [
        doc.write({ name: 'a', count: 1 }),
        doc.write({ name: 'b', count: 2 }),
        doc.write({ name: 'c', count: 3 }),
      ]
      await Promise.all(writes)

      const result = await doc.read()
      expect(result).toEqual({ kind: 'valid', value: { name: 'c', count: 3 } })
      expect(await listTmpFiles(directory)).toEqual([])
    })
  })

  it('surfaces write failures and does not block the next write after rejection', async () => {
    await withTemporaryDirectory('porcelain-dat-001-write-fail-', async (directory) => {
      const path = join(directory, 'doc.json')
      const doc = documentAt(path)

      await doc.write({ name: 'ok', count: 1 })

      // Parent directory becomes non-writable → tmp create / rename fails.
      await chmod(directory, 0o555)
      await expect(doc.write({ name: 'blocked', count: 2 })).rejects.toThrow()
      await chmod(directory, 0o755)

      // FIFO tail continues after rejection.
      await doc.write({ name: 'recovered', count: 3 })
      const result = await doc.read()
      expect(result).toEqual({ kind: 'valid', value: { name: 'recovered', count: 3 } })
    })
  })

  it('covers every ReadStrictJsonDocument discriminant', async () => {
    await withTemporaryDirectory('porcelain-dat-001-taxonomy-', async (directory) => {
      const kinds = new Set<ReadStrictJsonDocument<SampleValue>['kind']>()

      const missingPath = join(directory, 'missing.json')
      kinds.add((await documentAt(missingPath).read()).kind)

      const validPath = join(directory, 'valid.json')
      const validDoc = documentAt(validPath)
      await validDoc.write({ name: 'v', count: 1 })
      kinds.add((await validDoc.read()).kind)

      const largePath = join(directory, 'large.json')
      await writeFile(largePath, 'y'.repeat(100), 'utf8')
      kinds.add((await documentAt(largePath, 10).read()).kind)

      const corruptPath = join(directory, 'corrupt.json')
      await writeFile(corruptPath, '{', 'utf8')
      kinds.add((await documentAt(corruptPath).read()).kind)

      const incompatPath = join(directory, 'incompat.json')
      await writeFile(
        incompatPath,
        JSON.stringify({ version: 2, value: { name: 'z', count: 0 } }),
        'utf8',
      )
      kinds.add((await documentAt(incompatPath).read()).kind)

      const mismatchPath = join(directory, 'mismatch.json')
      await writeFile(
        mismatchPath,
        JSON.stringify({ version: 1, value: { name: 'z', count: 'not-a-number' } }),
        'utf8',
      )
      kinds.add((await documentAt(mismatchPath).read()).kind)

      expect(kinds).toEqual(
        new Set([
          'missing',
          'valid',
          'too-large',
          'corrupt',
          'incompatible-version',
          'schema-mismatch',
        ]),
      )
    })
  })

  it('creates the parent directory on write', async () => {
    await withTemporaryDirectory('porcelain-dat-001-mkdir-', async (directory) => {
      const path = join(directory, 'a', 'b', 'doc.json')
      await documentAt(path).write({ name: 'nested', count: 0 })
      await expect(stat(path)).resolves.toBeDefined()
      // parent existed only via write
      await expect(stat(join(directory, 'a', 'b'))).resolves.toBeDefined()
      await expect(mkdir(join(directory, 'a', 'b'), { recursive: true })).resolves.toBeUndefined()
    })
  })
})

/**
 * The envelope is now a schema, not a hand-narrowed record. Its outcomes are load-bearing:
 * an unreadable envelope must be backed up, and a version this build does not speak must
 * leave the file exactly where the older (or newer) build can still read it.
 */
describe('persisted envelope boundary', () => {
  async function readEnvelope(
    directory: string,
    name: string,
    raw: string,
  ): Promise<{ result: ReadStrictJsonDocument<SampleValue>; survivors: string[] }> {
    const path = join(directory, name)
    await writeFile(path, raw, 'utf8')
    const result = await documentAt(path).read()
    return { result, survivors: await readdir(directory) }
  }

  it('backs up every envelope shape that is not an object with a finite version', async () => {
    await withTemporaryDirectory('porcelain-dat-001-envelope-corrupt-', async (directory) => {
      const malformed = [
        '[{"version":1,"value":{"name":"x","count":1}}]',
        'null',
        '"just a string"',
        '42',
        '{"version":"1","value":{"name":"x","count":1}}',
        '{"version":null,"value":{"name":"x","count":1}}',
        '{"value":{"name":"x","count":1}}',
      ]
      let index = 0
      for (const raw of malformed) {
        index += 1
        const name = `envelope-${index}.json`
        const { result, survivors } = await readEnvelope(directory, name, raw)
        expect(result.kind, raw).toBe('corrupt')
        if (result.kind !== 'corrupt') return
        expect(result.backupPath.startsWith(join(directory, `${name}.corrupt-`))).toBe(true)
        expect(survivors).not.toContain(name)
        expect(await readFile(result.backupPath, 'utf8')).toBe(raw)
      }
    })
  })

  it('reports a version-1 envelope whose value the caller schema rejects as schema-mismatch, not corrupt', async () => {
    await withTemporaryDirectory('porcelain-dat-001-envelope-value-', async (directory) => {
      for (const [index, raw] of ['{"version":1}', '{"version":1,"value":null}'].entries()) {
        const name = `value-${index}.json`
        const { result, survivors } = await readEnvelope(directory, name, raw)
        expect(result.kind, raw).toBe('schema-mismatch')
        expect(survivors).toContain(name)
      }
    })
  })

  it('leaves any other numeric version untouched, in both directions', async () => {
    await withTemporaryDirectory('porcelain-dat-001-envelope-version-', async (directory) => {
      for (const version of [0, 2, -1, 1.5, 1000]) {
        const name = `version-${String(version).replace('.', '-')}.json`
        const raw = JSON.stringify({ version, value: { name: 'x', count: 1 } })
        const { result, survivors } = await readEnvelope(directory, name, raw)
        expect(result, String(version)).toEqual({ kind: 'incompatible-version', version })
        expect(survivors).toContain(name)
        expect(await readFile(join(directory, name), 'utf8')).toBe(raw)
      }
    })
  })

  it('reads a well-formed envelope and ignores fields it does not own', async () => {
    await withTemporaryDirectory('porcelain-dat-001-envelope-valid-', async (directory) => {
      const raw = JSON.stringify({
        version: PERSISTED_FORMAT_VERSION,
        value: { name: 'x', count: 1 },
        writtenBy: '0.99.0',
      })
      const { result, survivors } = await readEnvelope(directory, 'valid.json', raw)
      expect(result).toEqual({ kind: 'valid', value: { name: 'x', count: 1 } })
      expect(survivors).toEqual(['valid.json'])
    })
  })
})
