import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  hiddenPathsForRepo,
  hidePath,
  migrateScopeFromConfig,
  pinnedPathsForRepo,
  pinPath,
  readRepoScope,
  resolveScopePath,
  unhidePath,
  unpinPath,
} from './scope-store'

const { loadConfig } = vi.hoisted(() => ({ loadConfig: vi.fn() }))
vi.mock('./config-store', () => ({ loadConfig }))

const dir = join(tmpdir(), 'porcelain-scope-store-test')
const file = join(dir, 'scope.json')

beforeEach(() => {
  process.env.PORCELAIN_SCOPE = file
  rmSync(dir, { recursive: true, force: true })
  loadConfig.mockReset()
})
afterEach(() => {
  delete process.env.PORCELAIN_SCOPE
  rmSync(dir, { recursive: true, force: true })
})

describe('resolveScopePath', () => {
  it('joins relative paths under the repo', () => {
    expect(resolveScopePath('/repo', 'apps/web')).toBe('/repo/apps/web')
  })

  it('keeps absolute paths under the repo', () => {
    expect(resolveScopePath('/repo', '/repo/apps/web')).toBe('/repo/apps/web')
  })

  it('rejects empty path', () => {
    expect(() => resolveScopePath('/repo', '  ')).toThrow('non-empty')
  })
})

describe('scope-store mutations', () => {
  it('hides and unhides without duplicates', async () => {
    await hidePath('/repo', 'apps/legacy')
    await hidePath('/repo', 'apps/legacy')
    expect(await hiddenPathsForRepo('/repo')).toEqual(new Set(['/repo/apps/legacy']))
    await unhidePath('/repo', 'apps/legacy')
    expect(await hiddenPathsForRepo('/repo')).toEqual(new Set())
  })

  it('pins and unpins', async () => {
    await pinPath('/repo', '/repo/apps/web')
    await pinPath('/repo', 'apps/web')
    expect(await pinnedPathsForRepo('/repo')).toEqual(['/repo/apps/web'])
    await unpinPath('/repo', 'apps/web')
    expect(await pinnedPathsForRepo('/repo')).toEqual([])
  })

  it('isolates repos', async () => {
    await hidePath('/a', 'x')
    await pinPath('/b', 'y')
    expect((await readRepoScope('/a')).hiddenPaths).toEqual(['/a/x'])
    expect((await readRepoScope('/b')).pinnedPaths).toEqual(['/b/y'])
  })
})

describe('migrateScopeFromConfig', () => {
  it('copies legacy hidden/pinned into the channel', async () => {
    loadConfig.mockResolvedValue({
      recentRepos: [],
      repos: {
        '/repo': {
          hiddenPaths: ['/repo/legacy'],
          pinnedPaths: ['/repo/web'],
        },
      },
    })
    await migrateScopeFromConfig()
    expect(await hiddenPathsForRepo('/repo')).toEqual(new Set(['/repo/legacy']))
    expect(await pinnedPathsForRepo('/repo')).toEqual(['/repo/web'])
  })

  it('does not clobber existing channel lists with empty legacy merge of same side', async () => {
    await hidePath('/repo', 'keep-me')
    loadConfig.mockResolvedValue({
      recentRepos: [],
      repos: {
        '/repo': {
          hiddenPaths: ['/repo/old'],
          pinnedPaths: ['/repo/pin'],
        },
      },
    })
    await migrateScopeFromConfig()
    // hidden already present → keep channel; pinned was empty → fill from legacy
    expect(await hiddenPathsForRepo('/repo')).toEqual(new Set(['/repo/keep-me']))
    expect(await pinnedPathsForRepo('/repo')).toEqual(['/repo/pin'])
  })
})
