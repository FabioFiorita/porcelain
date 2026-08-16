import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import type { ChangedFile, DiffStat } from '../git/diff'
import { gitEnv } from '../git/git-env'
import { clearWorkingTreeSnapshot } from '../git/working-tree'
import { DEFAULT_LAYERS } from './default-layers'
import type { FlowGroup } from './flow'
import {
  loadCommitFlow,
  loadRangeFlow,
  loadWorkingFlow,
  readSourcesAndBuildFlow,
} from './flow-build'

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Test User',
  GIT_AUTHOR_EMAIL: 'test@porcelain.test',
  GIT_COMMITTER_NAME: 'Test User',
  GIT_COMMITTER_EMAIL: 'test@porcelain.test',
  GIT_AUTHOR_DATE: '2024-01-01T12:00:00Z',
  GIT_COMMITTER_DATE: '2024-01-01T12:00:00Z',
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    env: gitEnv(process.env, GIT_ENV),
    stdio: 'pipe',
  }).toString()
}

const dirs: string[] = []

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(dir)
  return dir
}

const modified = (path: string): ChangedFile => ({
  path,
  status: 'modified',
  staged: false,
  unstaged: true,
})

const flat = (groups: FlowGroup[]): FlowGroup['files'] => groups.flatMap((group) => group.files)
const fileAt = (groups: FlowGroup[], path: string): FlowGroup['files'][number] | undefined =>
  flat(groups).find((file) => file.path === path)

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('readSourcesAndBuildFlow', () => {
  it('merges additions/deletions from the stat map onto the matching files', async () => {
    const dir = await tempDir('porcelain-flow-stats-')
    await writeFile(join(dir, 'a.ts'), 'export const a = 1\n')
    await writeFile(join(dir, 'b.ts'), 'export const b = 2\n')
    const stats: DiffStat[] = [{ path: 'b.ts', additions: 3, deletions: 1 }]

    const groups = await readSourcesAndBuildFlow(
      dir,
      [modified('a.ts'), modified('b.ts')],
      stats,
      DEFAULT_LAYERS,
    )

    expect(fileAt(groups, 'b.ts')).toMatchObject({ additions: 3, deletions: 1 })
    // No stat entry → the counts stay undefined rather than borrowing another file's.
    expect(fileAt(groups, 'a.ts')?.additions).toBeUndefined()
    expect(fileAt(groups, 'a.ts')?.deletions).toBeUndefined()
  })

  it('reads at most 200 sources — the 201st file gets no parsed imports', async () => {
    const dir = await tempDir('porcelain-flow-cap-')
    await writeFile(join(dir, 'lib.ts'), 'export const lib = 1\n')
    const files = [modified('lib.ts')]
    for (let i = 0; i < 200; i++) {
      const path = `f${String(i).padStart(3, '0')}.ts`
      await writeFile(join(dir, path), "import { lib } from './lib'\nexport const v = lib\n")
      files.push(modified(path))
    }

    const groups = await readSourcesAndBuildFlow(dir, files, [], DEFAULT_LAYERS)

    // lib.ts + f000..f198 are the first 200 entries; f199 is over the cap.
    expect(fileAt(groups, 'f198.ts')?.connects).toEqual(['lib.ts'])
    expect(fileAt(groups, 'f199.ts')?.connects).toEqual([])
  })

  it('skips a file that cannot be read instead of throwing', async () => {
    const dir = await tempDir('porcelain-flow-unreadable-')
    await writeFile(join(dir, 'kept.ts'), "import { g } from './gone'\nexport const k = g\n")

    const groups = await readSourcesAndBuildFlow(
      dir,
      [modified('kept.ts'), { path: 'gone.ts', status: 'deleted', staged: true }],
      [],
      DEFAULT_LAYERS,
    )

    expect(
      flat(groups)
        .map((file) => file.path)
        .sort(),
    ).toEqual(['gone.ts', 'kept.ts'])
    expect(fileAt(groups, 'gone.ts')?.connects).toEqual([])
    expect(fileAt(groups, 'kept.ts')?.connects).toEqual(['gone.ts'])
  })

  it('ignores a source at the 1MB cap', async () => {
    const dir = await tempDir('porcelain-flow-huge-')
    await writeFile(join(dir, 'lib.ts'), 'export const lib = 1\n')
    const head = "import { lib } from './lib'\n"
    await writeFile(join(dir, 'huge.ts'), head + 'x'.repeat(1024 * 1024 - head.length))

    const groups = await readSourcesAndBuildFlow(
      dir,
      [modified('lib.ts'), modified('huge.ts')],
      [],
      DEFAULT_LAYERS,
    )

    expect(fileAt(groups, 'huge.ts')?.connects).toEqual([])
  })
})

// The 3s gitFlow poll is only cheap because these loaders memoize on
// status+numstat+layers. Identity (`toBe`) is the observable: a hit returns the
// stored array, a miss builds a fresh one.
describe('flow loaders', () => {
  async function repo(prefix: string): Promise<string> {
    const dir = await tempDir(prefix)
    git(dir, 'init', '-b', 'main')
    await mkdir(join(dir, 'src'), { recursive: true })
    await writeFile(join(dir, 'src', 'a.ts'), 'export const a = 1\n')
    git(dir, 'add', '-A')
    git(dir, '-c', 'commit.gpgsign=false', 'commit', '-m', 'root')
    return dir
  }

  it('loadWorkingFlow serves the memo when status, numstat, and layers are unchanged', async () => {
    const dir = await repo('porcelain-flow-hit-')
    await writeFile(join(dir, 'src', 'a.ts'), 'export const a = 2\n')

    const first = await loadWorkingFlow(dir)
    // Drop the snapshot so git is re-read: only the flow memo can serve the second call.
    clearWorkingTreeSnapshot(dir)
    expect(await loadWorkingFlow(dir)).toBe(first)
  })

  it('loadWorkingFlow busts the memo when the numstat changes', async () => {
    const dir = await repo('porcelain-flow-numstat-')
    await writeFile(join(dir, 'src', 'a.ts'), 'export const a = 2\n')
    const first = await loadWorkingFlow(dir)

    await writeFile(join(dir, 'src', 'a.ts'), 'export const a = 2\nexport const b = 3\n')
    clearWorkingTreeSnapshot(dir)
    expect(await loadWorkingFlow(dir)).not.toBe(first)
  })

  it('loadWorkingFlow busts the memo when the status changes', async () => {
    const dir = await repo('porcelain-flow-status-')
    await writeFile(join(dir, 'src', 'a.ts'), 'export const a = 2\n')
    const first = await loadWorkingFlow(dir)

    await writeFile(join(dir, 'src', 'b.ts'), 'export const b = 3\n')
    clearWorkingTreeSnapshot(dir)
    const second = await loadWorkingFlow(dir)
    expect(second).not.toBe(first)
    expect(fileAt(second, 'src/b.ts')).toBeDefined()
  })

  it('loadRangeFlow reports the base branch and memoizes the range', async () => {
    const dir = await repo('porcelain-flow-range-')
    git(dir, 'checkout', '-b', 'feature')
    await writeFile(join(dir, 'src', 'b.ts'), 'export const b = 3\n')
    git(dir, 'add', '-A')
    git(dir, '-c', 'commit.gpgsign=false', 'commit', '-m', 'feature')

    const first = await loadRangeFlow(dir)
    expect(first.base).toBe('main')
    expect(fileAt(first.groups, 'src/b.ts')).toBeDefined()
    expect((await loadRangeFlow(dir)).groups).toBe(first.groups)
  })

  it('loadCommitFlow memoizes an immutable commit and returns [] for an unknown hash', async () => {
    const dir = await repo('porcelain-flow-commit-')
    const hash = git(dir, 'rev-parse', 'HEAD').trim()

    const first = await loadCommitFlow(dir, hash)
    expect(fileAt(first, 'src/a.ts')).toBeDefined()
    expect(await loadCommitFlow(dir, hash)).toBe(first)
    expect(await loadCommitFlow(dir, 'deadbeef')).toEqual([])
  })
})
