// @vitest-environment node
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PROJECT_FILES, projectPorcelainPath } from '@shared/project-porcelain'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { withTemporaryDirectory } from '../../testing/temporary-directory'
import {
  createProjectManifestDocument,
  PROJECT_MANIFEST_LAYOUT,
  projectManifestPath,
  projectManifestValueSchema,
} from './project-manifest'

describe('projectManifestValueSchema', () => {
  it('accepts only { layout: project-companion-v1 }', () => {
    expect(projectManifestValueSchema.parse({ layout: PROJECT_MANIFEST_LAYOUT })).toEqual({
      layout: 'project-companion-v1',
    })
    expect(projectManifestValueSchema.safeParse({}).success).toBe(false)
    expect(projectManifestValueSchema.safeParse({ layout: 'other' }).success).toBe(false)
    expect(
      projectManifestValueSchema.safeParse({
        layout: PROJECT_MANIFEST_LAYOUT,
        extra: true,
      }).success,
    ).toBe(false)
  })
})

describe('createProjectManifestDocument', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects a non-absolute repoPath', () => {
    expect(() => createProjectManifestDocument('relative-repo')).toThrow(/absolute/)
  })

  it('returns missing when the manifest does not exist', async () => {
    await withTemporaryDirectory('porcelain-pdt-001-missing-', async (repoPath) => {
      const doc = createProjectManifestDocument(repoPath)
      expect(await doc.read()).toEqual({ kind: 'missing' })
      expect(await readdir(repoPath)).toEqual([])
    })
  })

  it('writes a v1 envelope and reads it back', async () => {
    await withTemporaryDirectory('porcelain-pdt-001-roundtrip-', async (repoPath) => {
      const doc = createProjectManifestDocument(repoPath)
      const value = { layout: PROJECT_MANIFEST_LAYOUT } as const
      await doc.write(value)

      expect(await doc.read()).toEqual({ kind: 'valid', value })
      const path = projectManifestPath(repoPath)
      expect(path).toBe(projectPorcelainPath(repoPath, PROJECT_FILES.manifest))
      const raw = await readFile(path, 'utf8')
      expect(raw).toBe(`${JSON.stringify({ version: 1, value }, null, 2)}\n`)
      expect((await stat(path)).mode & 0o777).toBe(0o600)
      const leftover = (await readdir(join(repoPath, '.porcelain'))).filter((name) =>
        name.startsWith('.tmp-'),
      )
      expect(leftover).toEqual([])
    })
  })

  it('backs up malformed JSON and removes the original path', async () => {
    await withTemporaryDirectory('porcelain-pdt-001-malformed-', async (repoPath) => {
      const path = projectManifestPath(repoPath)
      await mkdir(join(repoPath, '.porcelain'), { recursive: true })
      const original = '{ not json'
      await writeFile(path, original, 'utf8')

      const result = await createProjectManifestDocument(repoPath).read()
      expect(result.kind).toBe('corrupt')
      if (result.kind !== 'corrupt') return
      await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' })
      expect(await readFile(result.backupPath, 'utf8')).toBe(original)
    })
  })

  it('backs up unversioned JSON and invalid values as corrupt', async () => {
    await withTemporaryDirectory('porcelain-pdt-001-unversioned-', async (repoPath) => {
      const path = projectManifestPath(repoPath)
      await mkdir(join(repoPath, '.porcelain'), { recursive: true })
      const original = `${JSON.stringify({ layout: PROJECT_MANIFEST_LAYOUT }, null, 2)}\n`
      await writeFile(path, original, 'utf8')

      const result = await createProjectManifestDocument(repoPath).read()
      expect(result.kind).toBe('corrupt')
      if (result.kind !== 'corrupt') return
      await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' })
      expect(await readFile(result.backupPath, 'utf8')).toBe(original)
    })

    await withTemporaryDirectory('porcelain-pdt-001-invalid-value-', async (repoPath) => {
      const path = projectManifestPath(repoPath)
      await mkdir(join(repoPath, '.porcelain'), { recursive: true })
      const original = `${JSON.stringify({ version: 1, value: { layout: 'other' } }, null, 2)}\n`
      await writeFile(path, original, 'utf8')

      const result = await createProjectManifestDocument(repoPath).read()
      expect(result.kind).toBe('corrupt')
      if (result.kind !== 'corrupt') return
      await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' })
      expect(await readFile(result.backupPath, 'utf8')).toBe(original)
    })
  })

  it('leaves a numeric version other than 1 in place', async () => {
    await withTemporaryDirectory('porcelain-pdt-001-incompat-', async (repoPath) => {
      const path = projectManifestPath(repoPath)
      await mkdir(join(repoPath, '.porcelain'), { recursive: true })
      const original = `${JSON.stringify({ version: 99, value: { layout: PROJECT_MANIFEST_LAYOUT } }, null, 2)}\n`
      await writeFile(path, original, 'utf8')

      expect(await createProjectManifestDocument(repoPath).read()).toEqual({
        kind: 'incompatible-version',
        version: 99,
      })
      expect(await readFile(path, 'utf8')).toBe(original)
    })
  })

  it('reports oversize without rewriting the source', async () => {
    await withTemporaryDirectory('porcelain-pdt-001-large-', async (repoPath) => {
      const path = projectManifestPath(repoPath)
      await mkdir(join(repoPath, '.porcelain'), { recursive: true })
      const payload = 'x'.repeat(200)
      await writeFile(path, payload, 'utf8')
      const maxBytes = 50

      expect(await createProjectManifestDocument(repoPath, maxBytes).read()).toEqual({
        kind: 'too-large',
        byteLength: Buffer.byteLength(payload, 'utf8'),
        maxBytes,
      })
      expect(await readFile(path, 'utf8')).toBe(payload)
    })
  })
})
