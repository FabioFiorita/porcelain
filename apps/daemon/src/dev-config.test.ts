import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { devRepoPath, isRecognizedDevPlayground, seedDevConfig } from './dev-config'
import { initHubInventoryStore, initProjectsRecentsDir } from './features/projects'

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
    expect(
      isRecognizedDevPlayground('/home/test/code/porcelain-playground-worktrees/topic', primary),
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
      const inventory = initHubInventoryStore(root)
      initProjectsRecentsDir(root)
      await inventory.writeProjects([
        {
          id: 'porcelain',
          commonGitDir: join(root, 'code', 'porcelain', '.git'),
          groupingKey: 'name:porcelain',
          name: 'porcelain',
          worktrees: [],
        },
        {
          id: 'playground',
          commonGitDir: join(playground, '.git'),
          groupingKey: 'name:playground',
          name: 'playground',
          worktrees: [],
        },
      ])
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
      const catalog = await inventory.readProjects()
      expect(catalog.ok && catalog.value.map((project) => project.id)).toEqual(['playground'])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects a symlinked playground path that resolves outside the sandbox', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-dev-symlink-'))
    try {
      const playground = join(root, 'playground')
      const production = join(root, 'production')
      await mkdir(playground, { recursive: true })
      await mkdir(production, { recursive: true })
      const escaped = join(playground, 'linked-repo')
      await symlink(production, escaped, 'dir')

      expect(isRecognizedDevPlayground(escaped, playground)).toBe(false)
      // Missing children are handled without throwing and remain outside the single primary
      // playground repo; the project operation never warms or registers them.
      expect(isRecognizedDevPlayground(join(playground, 'new-repo'), playground)).toBe(false)
      expect(isRecognizedDevPlayground(join(escaped, 'missing'), playground)).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects a symlinked managed worktree root even when its child is reachable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-dev-root-link-'))
    try {
      const primary = join(root, 'code', 'porcelain-playground')
      const managedRoot = join(root, 'code', 'porcelain-playgrounds')
      const productionRoot = join(root, 'production-worktrees')
      await mkdir(primary, { recursive: true })
      await mkdir(productionRoot, { recursive: true })
      await symlink(productionRoot, managedRoot, 'dir')
      const escaped = join(managedRoot, 'agent-worktree')
      await mkdir(join(productionRoot, 'agent-worktree'), { recursive: true })

      expect(isRecognizedDevPlayground(escaped, primary)).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
