import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { devRepoPath, isRecognizedDevPlayground, seedDevConfig } from './dev-config'
import { initProjectsRecentsDir } from './features/projects'

describe('devRepoPath', () => {
  it('keeps the primary development playground by default', () => {
    expect(devRepoPath({}, '/home/test')).toBe('/home/test/code/porcelain-playground')
  })

  it('uses the managed worktree playground when provided', () => {
    expect(
      devRepoPath(
        { PORCELAIN_DEV_PLAYGROUND: '/home/test/code/porcelain-playgrounds/fix-review' },
        '/home/test',
      ),
    ).toBe('/home/test/code/porcelain-playgrounds/fix-review')
  })

  it('recognizes only the primary or managed playground paths', () => {
    const primary = '/home/test/code/porcelain-playground'
    expect(isRecognizedDevPlayground(primary, primary)).toBe(true)
    expect(
      isRecognizedDevPlayground('/home/test/code/porcelain-playgrounds/fix-review', primary),
    ).toBe(true)
    expect(isRecognizedDevPlayground('/home/test/code/porcelain', primary)).toBe(false)
    expect(isRecognizedDevPlayground('/home/test/code/soaphealth', primary)).toBe(false)
  })

  it('prunes real-repo registrations and seeds the disposable playground only', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-dev-config-'))
    try {
      const playground = join(root, 'code', 'porcelain-playground')
      await mkdir(playground, { recursive: true })
      const recents = join(root, 'projects-recents.json')
      initProjectsRecentsDir(root)
      await writeFile(
        recents,
        JSON.stringify({
          version: 1,
          value: { paths: [join(root, 'porcelain'), join(root, 'soaphealth')] },
        }),
      )

      await seedDevConfig({ PORCELAIN_DEV_PLAYGROUND: playground }, root)

      const value = JSON.parse(await readFile(recents, 'utf8')) as {
        value: { paths: string[] }
      }
      expect(value.value.paths).toEqual([playground])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
