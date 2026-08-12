// @vitest-environment node
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { withTemporaryDirectory } from '../../testing/temporary-directory'
import {
  commandFingerprint,
  createJsonActionTrustStore,
  trustMigratedCommands,
} from './json-action-trust-store'

const PROJECT = '/synthetic/repo'

describe('commandFingerprint', () => {
  it('is stable for the same command text and changes when the command changes', () => {
    const a = commandFingerprint('make build')
    const b = commandFingerprint('make build')
    const c = commandFingerprint('make test')
    expect(a).toBe(b)
    expect(a).toHaveLength(32)
    expect(a).not.toBe(c)
  })
})

describe('createJsonActionTrustStore', () => {
  afterEach(() => {
    delete process.env.PORCELAIN_ACTION_TRUST_FILE
  })

  it('round-trips fingerprints under the env path override', async () => {
    await withTemporaryDirectory('porcelain-action-trust-roundtrip-', async (directory) => {
      const path = join(directory, 'action-trust.json')
      process.env.PORCELAIN_ACTION_TRUST_FILE = path
      const store = createJsonActionTrustStore()

      expect(await store.readFingerprints(PROJECT)).toEqual({ ok: true, value: new Set() })
      expect(await store.trustCommands(PROJECT, ['make build', 'make test'])).toEqual({
        ok: true,
        value: undefined,
      })

      const raw = JSON.parse(await readFile(path, 'utf8')) as {
        version: number
        projects: Record<string, string[]>
      }
      expect(raw.version).toBe(1)
      expect(new Set(raw.projects[PROJECT])).toEqual(
        new Set([commandFingerprint('make build'), commandFingerprint('make test')]),
      )

      const read = await store.readFingerprints(PROJECT)
      expect(read.ok).toBe(true)
      if (!read.ok) return
      expect(read.value.has(commandFingerprint('make build'))).toBe(true)
    })
  })

  it('backs up unversioned or malformed documents and fails closed on read', async () => {
    await withTemporaryDirectory('porcelain-action-trust-legacy-', async (directory) => {
      const path = join(directory, 'action-trust.json')
      process.env.PORCELAIN_ACTION_TRUST_FILE = path
      await writeFile(path, JSON.stringify({ [PROJECT]: ['deadbeef'] }))

      const store = createJsonActionTrustStore()
      expect(await store.readFingerprints(PROJECT)).toEqual({ ok: true, value: new Set() })
      const entries = await readdir(directory)
      expect(entries.some((name) => name.startsWith('action-trust.json.corrupt-'))).toBe(true)

      // After backup the original path is gone — trustCommands can create a fresh v1 document.
      expect(await store.trustCommands(PROJECT, ['echo hi'])).toEqual({
        ok: true,
        value: undefined,
      })
      const restored = JSON.parse(await readFile(path, 'utf8')) as { version: number }
      expect(restored.version).toBe(1)
    })
  })

  it('refuses trustCommands after an oversize document without rewriting it', async () => {
    await withTemporaryDirectory('porcelain-action-trust-large-', async (directory) => {
      const path = join(directory, 'action-trust.json')
      process.env.PORCELAIN_ACTION_TRUST_FILE = path
      const payload = 'x'.repeat(200)
      await writeFile(path, payload)

      const store = createJsonActionTrustStore({ maxBytes: 50 })
      expect(await store.readFingerprints(PROJECT)).toEqual({ ok: true, value: new Set() })
      expect(await store.trustCommands(PROJECT, ['make'])).toEqual({
        ok: false,
        error: { code: 'actions.unavailable' },
      })
      expect(await readFile(path, 'utf8')).toBe(payload)
    })
  })

  it('trustMigratedCommands is a no-op for empty lists and writes for non-empty', async () => {
    await withTemporaryDirectory('porcelain-action-trust-migrate-', async (directory) => {
      const path = join(directory, 'action-trust.json')
      process.env.PORCELAIN_ACTION_TRUST_FILE = path
      await trustMigratedCommands(PROJECT, [])
      await expect(readFile(path, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })

      // trustMigratedCommands uses the module default store which honors the env path.
      await trustMigratedCommands(PROJECT, ['pnpm test'])
      const raw = JSON.parse(await readFile(path, 'utf8')) as {
        projects: Record<string, string[]>
      }
      expect(raw.projects[PROJECT]).toEqual([commandFingerprint('pnpm test')])
    })
  })

  it('merges fingerprints for the same project across calls', async () => {
    await withTemporaryDirectory('porcelain-action-trust-merge-', async (directory) => {
      const path = join(directory, 'action-trust.json')
      const store = createJsonActionTrustStore({ path })
      await store.trustCommands(PROJECT, ['one'])
      await store.trustCommands(PROJECT, ['two'])
      const read = await store.readFingerprints(PROJECT)
      expect(read.ok).toBe(true)
      if (!read.ok) return
      expect(read.value).toEqual(new Set([commandFingerprint('one'), commandFingerprint('two')]))
    })
  })
})
