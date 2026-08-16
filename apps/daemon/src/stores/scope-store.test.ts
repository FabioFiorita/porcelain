import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  hiddenPathsForRepo,
  hidePath,
  pinnedPathsForRepo,
  pinPath,
  readRepoScope,
  unhidePath,
  unpinPath,
} from './scope-store'

const root = join(tmpdir(), 'porcelain-scope-store-test')
const repo = join(root, 'repo')

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(repo, { recursive: true })
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('scope-store mutations', () => {
  it('merges tracked project defaults with private scope without writing the overlay', async () => {
    mkdirSync(join(repo, '.porcelain'), { recursive: true })
    writeFileSync(
      join(repo, '.porcelain', 'project.json'),
      JSON.stringify({
        hiddenPaths: ['tracked/hidden'],
        pinnedPaths: ['tracked/pinned'],
        worktrees: {},
      }),
    )
    await hidePath(repo, 'private/hidden')
    await pinPath(repo, 'private/pinned')

    expect(await readRepoScope(repo)).toEqual({
      hiddenPaths: [join(repo, 'private/hidden'), join(repo, 'tracked/hidden')],
      pinnedPaths: [join(repo, 'private/pinned'), join(repo, 'tracked/pinned')],
    })
    expect(
      JSON.parse(readFileSync(join(repo, '.porcelain', 'project.json'), 'utf8')),
    ).toMatchObject({
      hiddenPaths: ['tracked/hidden'],
      pinnedPaths: ['tracked/pinned'],
    })
  })

  it('hides and unhides without duplicates', async () => {
    await hidePath(repo, 'apps/legacy')
    await hidePath(repo, 'apps/legacy')
    expect(await hiddenPathsForRepo(repo)).toEqual(new Set([join(repo, 'apps/legacy')]))
    await unhidePath(repo, 'apps/legacy')
    expect(await hiddenPathsForRepo(repo)).toEqual(new Set())
  })

  it('pins and unpins', async () => {
    await pinPath(repo, join(repo, 'apps/web'))
    await pinPath(repo, 'apps/web')
    expect(await pinnedPathsForRepo(repo)).toEqual([join(repo, 'apps/web')])
    await unpinPath(repo, 'apps/web')
    expect(await pinnedPathsForRepo(repo)).toEqual([])
  })

  it('isolates repos', async () => {
    const a = join(root, 'a')
    const b = join(root, 'b')
    mkdirSync(a, { recursive: true })
    mkdirSync(b, { recursive: true })
    await hidePath(a, 'x')
    await pinPath(b, 'y')
    expect((await readRepoScope(a)).hiddenPaths).toEqual([join(a, 'x')])
    expect((await readRepoScope(b)).pinnedPaths).toEqual([join(b, 'y')])
  })
})
