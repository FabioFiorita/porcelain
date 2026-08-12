// @vitest-environment node
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { porcelainHome } from '@shared/porcelain-home'
import {
  DEFAULT_PROJECT_GITIGNORE,
  PROJECT_FILES,
  projectPorcelainPath,
} from '@shared/project-porcelain'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { withTemporaryDirectory } from '../../testing/temporary-directory'
import { PROJECT_DATA_DOMAIN_FILES, PROJECT_DATA_DOMAIN_KEYS } from './project-data-ports'
import { createProjectDataStore, resetProjectDataRootMemo } from './project-data-store'
import { PROJECT_MANIFEST_LAYOUT, projectManifestPath } from './project-manifest'

const readFileSpy = vi.hoisted(() => vi.fn())

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    readFile: (...args: Parameters<typeof actual.readFile>) => {
      readFileSpy(...args)
      return actual.readFile(...args)
    },
  }
})

afterEach(() => {
  resetProjectDataRootMemo()
  vi.restoreAllMocks()
})

describe('createProjectDataStore ensureRoot', () => {
  it('creates the v1 companion root on a fresh repo', async () => {
    await withTemporaryDirectory('porcelain-pdt-001-fresh-', async (repoPath) => {
      const store = createProjectDataStore()
      expect(await store.ensureRoot(repoPath)).toEqual({ ok: true })

      const gitignore = await readFile(
        projectPorcelainPath(repoPath, PROJECT_FILES.gitignore),
        'utf8',
      )
      expect(gitignore).toBe(DEFAULT_PROJECT_GITIGNORE)
      expect(gitignore).toContain('/project-manifest.json')

      const manifestPath = projectManifestPath(repoPath)
      expect(JSON.parse(await readFile(manifestPath, 'utf8'))).toEqual({
        version: 1,
        value: { layout: PROJECT_MANIFEST_LAYOUT },
      })
      expect(await store.readManifest(repoPath)).toEqual({
        kind: 'valid',
        value: { layout: PROJECT_MANIFEST_LAYOUT },
      })
    })
  })

  it('leaves an existing unversioned board.json byte-identical', async () => {
    await withTemporaryDirectory('porcelain-pdt-001-beside-', async (repoPath) => {
      await mkdir(join(repoPath, '.porcelain'), { recursive: true })
      const boardPath = projectPorcelainPath(repoPath, PROJECT_FILES.board)
      const boardBytes = `${JSON.stringify({ cards: [{ title: 'Ship' }] }, null, 2)}\n`
      await writeFile(boardPath, boardBytes, 'utf8')

      const store = createProjectDataStore()
      expect(await store.ensureRoot(repoPath)).toEqual({ ok: true })
      expect(await readFile(boardPath, 'utf8')).toBe(boardBytes)
      expect(JSON.parse(await readFile(projectManifestPath(repoPath), 'utf8'))).toEqual({
        version: 1,
        value: { layout: PROJECT_MANIFEST_LAYOUT },
      })
    })
  })

  it('returns manifest-corrupt without writing a default or touching other files', async () => {
    await withTemporaryDirectory('porcelain-pdt-001-corrupt-root-', async (repoPath) => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      await mkdir(join(repoPath, '.porcelain'), { recursive: true })
      const boardPath = projectPorcelainPath(repoPath, PROJECT_FILES.board)
      const boardBytes = '{"cards":[]}\n'
      await writeFile(boardPath, boardBytes, 'utf8')
      const original = '{not-json'
      await writeFile(projectManifestPath(repoPath), original, 'utf8')

      const store = createProjectDataStore()
      const result = await store.ensureRoot(repoPath)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('project-data.manifest-corrupt')
      if (result.error.code !== 'project-data.manifest-corrupt') return
      expect(await readFile(result.error.backupPath, 'utf8')).toBe(original)
      expect(await readFile(boardPath, 'utf8')).toBe(boardBytes)
      await expect(stat(projectManifestPath(repoPath))).rejects.toMatchObject({
        code: 'ENOENT',
      })
    })
  })

  it('returns manifest-incompatible and leaves the file in place', async () => {
    await withTemporaryDirectory('porcelain-pdt-001-incompat-root-', async (repoPath) => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      await mkdir(join(repoPath, '.porcelain'), { recursive: true })
      const boardPath = projectPorcelainPath(repoPath, PROJECT_FILES.board)
      const boardBytes = '{"cards":[]}\n'
      await writeFile(boardPath, boardBytes, 'utf8')
      const original = `${JSON.stringify({ version: 99, value: { layout: PROJECT_MANIFEST_LAYOUT } }, null, 2)}\n`
      await writeFile(projectManifestPath(repoPath), original, 'utf8')

      const store = createProjectDataStore()
      expect(await store.ensureRoot(repoPath)).toEqual({
        ok: false,
        error: { code: 'project-data.manifest-incompatible', version: 99 },
      })
      expect(await readFile(projectManifestPath(repoPath), 'utf8')).toBe(original)
      expect(await readFile(boardPath, 'utf8')).toBe(boardBytes)
    })
  })

  it('returns manifest-too-large and leaves the file in place', async () => {
    await withTemporaryDirectory('porcelain-pdt-001-large-root-', async (repoPath) => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      await mkdir(join(repoPath, '.porcelain'), { recursive: true })
      const boardPath = projectPorcelainPath(repoPath, PROJECT_FILES.board)
      const boardBytes = '{"cards":[]}\n'
      await writeFile(boardPath, boardBytes, 'utf8')
      const payload = 'x'.repeat(17 * 1024)
      await writeFile(projectManifestPath(repoPath), payload, 'utf8')

      const store = createProjectDataStore()
      const result = await store.ensureRoot(repoPath)
      expect(result).toEqual({
        ok: false,
        error: {
          code: 'project-data.manifest-too-large',
          byteLength: Buffer.byteLength(payload, 'utf8'),
          maxBytes: 16 * 1024,
        },
      })
      expect(await readFile(projectManifestPath(repoPath), 'utf8')).toBe(payload)
      expect(await readFile(boardPath, 'utf8')).toBe(boardBytes)
    })
  })

  it('writes one manifest when concurrent ensureRoot share a repo', async () => {
    await withTemporaryDirectory('porcelain-pdt-001-concurrent-', async (repoPath) => {
      const store = createProjectDataStore()
      const results = await Promise.all([
        store.ensureRoot(repoPath),
        store.ensureRoot(repoPath),
        store.ensureRoot(repoPath),
      ])
      expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }])
      const entries = await readdir(join(repoPath, '.porcelain'))
      expect(entries.filter((name) => name === PROJECT_FILES.manifest)).toEqual([
        PROJECT_FILES.manifest,
      ])
      expect(entries.filter((name) => name.startsWith('.tmp-'))).toEqual([])
    })
  })

  it('never reads porcelainHome or a home companion path', async () => {
    await withTemporaryDirectory('porcelain-pdt-001-no-home-', async (repoPath) => {
      readFileSpy.mockClear()
      const store = createProjectDataStore()
      expect(await store.ensureRoot(repoPath)).toEqual({ ok: true })
      expect(await store.readManifest(repoPath)).toMatchObject({ kind: 'valid' })

      const home = porcelainHome()
      expect(readFileSpy.mock.calls.length).toBeGreaterThan(0)
      for (const [target] of readFileSpy.mock.calls) {
        if (typeof target !== 'string') continue
        expect(target === home || target.startsWith(`${home}/`)).toBe(false)
      }
    })
  })

  it('rejects a non-absolute repoPath', () => {
    const store = createProjectDataStore()
    expect(() => store.ensureRoot('relative-repo')).toThrow(/absolute/)
  })
})

describe('createProjectDataStore forDomain', () => {
  it('returns the exact path catalog and rejects unknown file names', () => {
    const store = createProjectDataStore()
    for (const key of PROJECT_DATA_DOMAIN_KEYS) {
      const domain = store.forDomain(key)
      expect(domain.domain).toBe(key)
      expect(domain.files).toEqual(PROJECT_DATA_DOMAIN_FILES[key])
    }

    expect(store.forDomain('projects').files).toEqual([])
    expect(store.forDomain('git').files).toEqual([])
    expect(store.forDomain('search').files).toEqual([])
    expect(store.forDomain('terminal').files).toEqual([])
    expect(store.forDomain('remote').files).toEqual([])

    expect(store.forDomain('board').path('/repo', PROJECT_FILES.board)).toBe(
      projectPorcelainPath('/repo', PROJECT_FILES.board),
    )
    expect(() => store.forDomain('board').path('/repo', PROJECT_FILES.notes)).toThrow(
      `project-data: ${PROJECT_FILES.notes} is not a board companion file`,
    )
  })
})
