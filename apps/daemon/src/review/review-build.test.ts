import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { gatherReview } from './review-build'

const dirs: string[] = []
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('Review Canvas build input', () => {
  it('returns no live Review when a Worktree has no daemon-root Canvas template', async () => {
    const repo = await mkdtemp(join(tmpdir(), 'porcelain-review-build-'))
    dirs.push(repo)
    execFileSync('git', ['init', '--initial-branch=main'], { cwd: repo })
    await writeFile(join(repo, 'README.md'), 'fixture\n')
    execFileSync('git', ['add', 'README.md'], { cwd: repo })
    execFileSync(
      'git',
      ['-c', 'user.email=test@example.com', '-c', 'user.name=Test', 'commit', '-m', 'fixture'],
      { cwd: repo, stdio: 'ignore' },
    )
    const gathered = await gatherReview(repo)
    expect(gathered.reviewSet).toBeNull()
    expect(gathered.files).toEqual([])
  })
})
