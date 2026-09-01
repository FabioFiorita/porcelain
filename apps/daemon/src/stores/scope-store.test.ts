// @vitest-environment node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { projectOverlayOverridesPath } from '@shared/project-porcelain'
import { projectOverridesPath } from '@shared/project-store'
import { describe, expect, it } from 'vitest'
import { withTemporaryDirectory } from '../testing/temporary-directory'
import { createScopeStore, type RepoIdentity } from './scope-store'

const PROJECT = 'project-1'
const WORKTREE = 'wt-feature'

async function writePrivate(homeDir: string, document: unknown): Promise<void> {
  await mkdir(join(homeDir, 'projects', PROJECT), { recursive: true })
  await writeFile(projectOverridesPath(homeDir, PROJECT), JSON.stringify(document, null, 2))
}

async function readPrivate(homeDir: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(projectOverridesPath(homeDir, PROJECT), 'utf8'))
}

async function writeTracked(repoPath: string, document: unknown): Promise<void> {
  await mkdir(join(repoPath, '.porcelain'), { recursive: true })
  await writeFile(projectOverlayOverridesPath(repoPath), JSON.stringify(document, null, 2))
}

/** One temp home + one temp repo, with the checkout registered as `WORKTREE`. */
async function withStore(
  run: (context: {
    store: ReturnType<typeof createScopeStore>
    homeDir: string
    repo: string
  }) => Promise<void>,
  identity: RepoIdentity | null = { projectId: PROJECT, worktreeId: WORKTREE },
): Promise<void> {
  await withTemporaryDirectory('porcelain-scope-store-', async (root) => {
    const homeDir = join(root, 'home')
    const repo = join(root, 'repo')
    await mkdir(repo, { recursive: true })
    const store = createScopeStore({ homeDir, identityForRepo: async () => identity })
    await run({ store, homeDir, repo })
  })
}

describe('project baseline', () => {
  it('is what an un-overridden worktree sees, as absolute paths', async () => {
    await withStore(async ({ store, homeDir, repo }) => {
      await writePrivate(homeDir, { hiddenPaths: ['dist'], pinnedPaths: ['README.md'] })

      await expect(store.readRepoScope(repo)).resolves.toEqual({
        hiddenPaths: [join(repo, 'dist')],
        pinnedPaths: [join(repo, 'README.md')],
      })
    })
  })

  it('merges hides and pins promoted into the checkout', async () => {
    await withStore(async ({ store, homeDir, repo }) => {
      await writePrivate(homeDir, { hiddenPaths: ['dist'], pinnedPaths: [] })
      await writeTracked(repo, { hiddenPaths: ['vendor'], pinnedPaths: [], worktrees: {} })

      const scope = await store.readRepoScope(repo)
      expect(scope.hiddenPaths).toEqual([join(repo, 'dist'), join(repo, 'vendor')])
    })
  })
})

describe('worktree override', () => {
  it('ignores legacy path overrides so every worktree keeps the project paths', async () => {
    await withStore(async ({ store, homeDir, repo }) => {
      await writePrivate(homeDir, {
        hiddenPaths: ['dist'],
        pinnedPaths: ['README.md'],
        worktreeProfiles: {
          [WORKTREE]: {
            pinnedPaths: ['apps/mobile'],
            hiddenPaths: ['apps/web'],
            unhiddenPaths: ['dist'],
          },
        },
      })

      const scope = await store.readRepoScope(repo)
      expect(scope).toEqual({
        pinnedPaths: [join(repo, 'README.md')],
        hiddenPaths: [join(repo, 'dist')],
      })
    })
  })
})

describe('layers', () => {
  it('inherits the project order when the worktree declares none', async () => {
    await withStore(async ({ store, homeDir, repo }) => {
      await writePrivate(homeDir, { layers: [{ label: 'View', pattern: 'components/' }] })

      await expect(store.layersForRepo(repo)).resolves.toEqual([
        { label: 'View', pattern: 'components/' },
      ])
    })
  })

  it('replaces the project order wholesale when the worktree declares its own', async () => {
    await withStore(async ({ store, homeDir, repo }) => {
      await writePrivate(homeDir, {
        layers: [{ label: 'View', pattern: 'components/' }],
        worktreeProfiles: { [WORKTREE]: { layers: [{ label: 'Screen', pattern: 'screens/' }] } },
      })

      await expect(store.layersForRepo(repo)).resolves.toEqual([
        { label: 'Screen', pattern: 'screens/' },
      ])
    })
  })

  /**
   * ADR 0006: focus and story order are personal. A tracked overlay is a file a
   * teammate can commit, so a `layers` key in one must not reach the reader —
   * while the hides that overlay legitimately carries still must.
   */
  it('ignores layers smuggled into the tracked overlay, but keeps its hides', async () => {
    await withStore(async ({ store, homeDir, repo }) => {
      await writePrivate(homeDir, {})
      await writeTracked(repo, {
        hiddenPaths: ['vendor'],
        pinnedPaths: [],
        worktrees: {},
        layers: [{ label: 'Someone else’s story', pattern: 'src/' }],
      })

      await expect(store.layersForRepo(repo)).resolves.toEqual([])
      expect((await store.readRepoScope(repo)).hiddenPaths).toEqual([join(repo, 'vendor')])
    })
  })
})

describe('the profile view', () => {
  it('replaces either level without clobbering the other', async () => {
    await withStore(async ({ store, repo }) => {
      await store.setProjectProfile(repo, {
        pinnedPaths: ['README.md'],
        hiddenPaths: ['dist'],
        layers: [{ label: 'Source', pattern: '^src/' }],
      })
      await store.setWorktreeProfile(repo, {
        layers: [{ label: 'Screen', pattern: '^screens/' }],
      })

      const view = await store.profileViewForRepo(repo)
      expect(view.base.pinnedPaths).toEqual(['README.md'])
      expect(view.override).toEqual({ layers: [{ label: 'Screen', pattern: '^screens/' }] })
      expect(view.resolved.hiddenPaths).toEqual(['dist'])

      await store.setWorktreeProfile(repo, null)
      expect((await store.profileViewForRepo(repo)).override).toBeNull()
      expect((await store.profileViewForRepo(repo)).base.pinnedPaths).toEqual(['README.md'])
    })
  })

  it('keeps legacy worktree paths out of both the override and resolved profile', async () => {
    await withStore(async ({ store, homeDir, repo }) => {
      await writePrivate(homeDir, {
        hiddenPaths: ['dist'],
        pinnedPaths: [],
        worktreeProfiles: { [WORKTREE]: { pinnedPaths: ['apps/mobile'] } },
      })

      const view = await store.profileViewForRepo(repo)
      expect(view.worktreeId).toBe(WORKTREE)
      expect(view.base).toEqual({ hiddenPaths: ['dist'], pinnedPaths: [], layers: [] })
      expect(view.override).toBeNull()
      expect(view.resolved.pinnedPaths).toEqual([])
    })
  })

  it('reports no override when the stored one says nothing', async () => {
    await withStore(async ({ store, homeDir, repo }) => {
      await writePrivate(homeDir, {
        worktreeProfiles: { [WORKTREE]: { layers: null } },
      })

      expect((await store.profileViewForRepo(repo)).override).toBeNull()
    })
  })

  it('is an empty, un-erroring view for a checkout the Hub does not know', async () => {
    await withStore(async ({ store, repo }) => {
      const view = await store.profileViewForRepo(repo)
      expect(view).toEqual({
        worktreeId: null,
        base: { hiddenPaths: [], pinnedPaths: [], layers: [] },
        override: null,
        resolved: { hiddenPaths: [], pinnedPaths: [], layers: [] },
      })
    }, null)
  })
})

describe('writing from the tree', () => {
  it('hides at the project level, so every worktree gets it', async () => {
    await withStore(async ({ store, homeDir, repo }) => {
      await writePrivate(homeDir, {})
      await store.hidePath(repo, join(repo, 'dist'))

      const view = await store.profileViewForRepo(repo)
      expect(view.base.hiddenPaths).toEqual(['dist'])
      expect(view.override).toBeNull()
    })
  })

  it('preserves profile fields while retiring legacy worktree setup', async () => {
    await withStore(async ({ store, homeDir, repo }) => {
      await writePrivate(homeDir, {
        hiddenPaths: [],
        pinnedPaths: [],
        worktrees: { main: { setup: { startScript: 'pnpm dev', disposeScript: '' } } },
        layers: [{ label: 'View', pattern: 'components/' }],
        worktreeProfiles: {
          'wt-other': { layers: [{ label: 'Mobile', pattern: 'apps/mobile/' }] },
        },
      })

      await store.pinPath(repo, join(repo, 'README.md'))

      const document = await readPrivate(homeDir)
      expect(document.pinnedPaths).toEqual(['README.md'])
      expect(document).not.toHaveProperty('worktrees')
      expect(document.layers).toEqual([{ label: 'View', pattern: 'components/' }])
      expect(document.worktreeProfiles).toEqual({ 'wt-other': expect.anything() })
    })
  })

  it('takes effect even when persisted legacy data tried to unhide the path', async () => {
    await withStore(async ({ store, homeDir, repo }) => {
      await writePrivate(homeDir, {
        worktreeProfiles: { [WORKTREE]: { unhiddenPaths: ['dist'] } },
      })

      await store.hidePath(repo, join(repo, 'dist'))
      expect((await store.readRepoScope(repo)).hiddenPaths).toEqual([join(repo, 'dist')])
    })
  })

  it('strips a sibling’s legacy path fields while preserving its layers on write', async () => {
    await withStore(async ({ store, homeDir, repo }) => {
      await writePrivate(homeDir, {
        worktreeProfiles: {
          'wt-other': {
            unhiddenPaths: ['dist'],
            layers: [{ label: 'View', pattern: 'apps/web/' }],
          },
        },
      })

      await store.hidePath(repo, join(repo, 'dist'))
      const document = await readPrivate(homeDir)
      expect(document.worktreeProfiles).toEqual({
        'wt-other': { layers: [{ label: 'View', pattern: 'apps/web/' }] },
      })
    })
  })

  it('writes nothing at all for a checkout the Hub does not know', async () => {
    await withStore(async ({ store, homeDir, repo }) => {
      await store.hidePath(repo, join(repo, 'dist'))
      await expect(readPrivate(homeDir)).rejects.toThrow()
    }, null)
  })
})
