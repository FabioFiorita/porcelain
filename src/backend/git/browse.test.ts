import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, parse } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { browseDirs } from './browse'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'porcelain-browse-test-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('browseDirs', () => {
  it('lists directories only, skipping files', async () => {
    await mkdir(join(dir, 'alpha'))
    await writeFile(join(dir, 'a-file.txt'), '')
    const { entries } = await browseDirs(dir)
    expect(entries.map((e) => e.name)).toEqual(['alpha'])
    expect(entries[0]?.path).toBe(join(dir, 'alpha'))
  })

  it('hides dotdirs', async () => {
    await mkdir(join(dir, 'visible'))
    await mkdir(join(dir, '.hidden'))
    const { entries } = await browseDirs(dir)
    expect(entries.map((e) => e.name)).toEqual(['visible'])
  })

  it('flags a directory containing a .git dir as a repo', async () => {
    await mkdir(join(dir, 'repo', '.git'), { recursive: true })
    await mkdir(join(dir, 'plain'))
    const { entries } = await browseDirs(dir)
    const byName = new Map(entries.map((e) => [e.name, e.isRepo]))
    expect(byName.get('repo')).toBe(true)
    expect(byName.get('plain')).toBe(false)
  })

  it('flags a directory with a .git FILE (worktree) as a repo', async () => {
    await mkdir(join(dir, 'worktree'))
    await writeFile(join(dir, 'worktree', '.git'), 'gitdir: /elsewhere\n')
    const { entries } = await browseDirs(dir)
    expect(entries.find((e) => e.name === 'worktree')?.isRepo).toBe(true)
  })

  it('sorts entries by name, case-insensitive', async () => {
    for (const name of ['Banana', 'apple', 'Cherry']) await mkdir(join(dir, name))
    const { entries } = await browseDirs(dir)
    expect(entries.map((e) => e.name)).toEqual(['apple', 'Banana', 'Cherry'])
  })

  it('reports the parent, and null at the filesystem root', async () => {
    const child = join(dir, 'child')
    await mkdir(child)
    expect((await browseDirs(child)).parent).toBe(dir)

    const root = parse(dir).root
    expect((await browseDirs(root)).parent).toBeNull()
  })

  it('defaults to the home directory when path is null', async () => {
    const result = await browseDirs(null)
    expect(result.path).toBe(process.env.HOME ?? result.path)
    expect(dirname(result.path)).toBe(result.parent ?? dirname(result.path))
  })

  it('throws on a nonexistent path', async () => {
    await expect(browseDirs(join(dir, 'nope'))).rejects.toThrow()
  })
})
