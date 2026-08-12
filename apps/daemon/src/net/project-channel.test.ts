// @vitest-environment node
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  DEFAULT_PROJECT_GITIGNORE,
  PROJECT_FILES,
  projectPorcelainPath,
} from '@shared/project-porcelain'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { resetProjectDataRootMemo } from '../features/project-data'
import { withTemporaryDirectory } from '../testing/temporary-directory'
import { createProjectChannel } from './project-channel'

vi.mock('../project/git-exclude', () => ({
  ensureCompanionHidden: vi.fn(async () => undefined),
}))
vi.mock('../review/review-watch', () => ({
  watchProjectCompanion: vi.fn(),
}))

const sampleSchema = z.object({ name: z.string() }).strict()

function sampleChannel() {
  return createProjectChannel({
    fileName: PROJECT_FILES.scope,
    schema: sampleSchema,
    empty: () => ({ name: '' }),
  })
}

afterEach(() => {
  resetProjectDataRootMemo()
  vi.restoreAllMocks()
})

describe('createProjectChannel', () => {
  it('creates the v1 manifest and default gitignore on first write', async () => {
    await withTemporaryDirectory('porcelain-pdt-001-channel-write-', async (repoPath) => {
      const channel = sampleChannel()
      await channel.write(repoPath, { name: 'scope' })

      expect(JSON.parse(await readFile(channel.path(repoPath), 'utf8'))).toEqual({ name: 'scope' })
      expect(
        JSON.parse(await readFile(projectPorcelainPath(repoPath, PROJECT_FILES.manifest), 'utf8')),
      ).toEqual({
        version: 1,
        value: { layout: 'project-companion-v1' },
      })
      expect(await readFile(projectPorcelainPath(repoPath, PROJECT_FILES.gitignore), 'utf8')).toBe(
        DEFAULT_PROJECT_GITIGNORE,
      )
    })
  })

  it('does not create a companion on read of a missing file', async () => {
    await withTemporaryDirectory('porcelain-pdt-001-channel-read-', async (repoPath) => {
      const channel = sampleChannel()
      expect(await channel.read(repoPath)).toEqual({ name: '' })
      expect(await readdir(repoPath)).toEqual([])
    })
  })

  it('rejects a write when the manifest is corrupt and does not write the domain file', async () => {
    await withTemporaryDirectory('porcelain-pdt-001-channel-corrupt-', async (repoPath) => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      await mkdir(join(repoPath, '.porcelain'), { recursive: true })
      await writeFile(projectPorcelainPath(repoPath, PROJECT_FILES.manifest), '{not-json', 'utf8')

      const channel = sampleChannel()
      await expect(channel.write(repoPath, { name: 'scope' })).rejects.toThrow(
        'project-data: project-data.manifest-corrupt',
      )
      await expect(readFile(channel.path(repoPath), 'utf8')).rejects.toMatchObject({
        code: 'ENOENT',
      })
    })
  })
})
