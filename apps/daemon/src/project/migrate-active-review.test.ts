import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { projectActiveReviewDir, projectPorcelainDir } from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrateActiveReviewLayout } from './migrate-active-review'

let repo = ''

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), 'porcelain-active-layout-'))
  await mkdir(projectPorcelainDir(repo), { recursive: true })
})

afterEach(async () => {
  await rm(repo, { recursive: true, force: true })
})

const flat = (...parts: string[]): string => join(projectPorcelainDir(repo), ...parts)
const active = (...parts: string[]): string => join(projectActiveReviewDir(repo), ...parts)

describe('folding a flat companion into active-review/', () => {
  it('moves every review slot, files and directories alike', async () => {
    await writeFile(flat('review.json'), '{"name":"A"}')
    await writeFile(flat('comments.json'), '[]')
    await writeFile(flat('reviewed.json'), '[]')
    await mkdir(flat('intent'), { recursive: true })
    await writeFile(flat('intent', 'index.md'), '# why')
    await mkdir(flat('evidence', 'assets'), { recursive: true })
    await writeFile(flat('evidence', 'index.html'), '<p>proof</p>')

    const { moved } = await migrateActiveReviewLayout(repo)
    expect(moved.sort()).toEqual(
      ['comments.json', 'evidence', 'intent', 'review.json', 'reviewed.json'].sort(),
    )
    expect(await readFile(active('review.json'), 'utf8')).toBe('{"name":"A"}')
    expect(await readFile(active('intent', 'index.md'), 'utf8')).toBe('# why')
    expect(await readFile(active('evidence', 'index.html'), 'utf8')).toBe('<p>proof</p>')
    await expect(stat(flat('review.json'))).rejects.toThrow()
  })

  it('leaves durable project data at the companion root', async () => {
    await writeFile(flat('board.json'), '[]')
    await writeFile(flat('actions.json'), '[]')
    await writeFile(flat('notes.md'), '# notes')
    await writeFile(flat('review.json'), '{}')
    await migrateActiveReviewLayout(repo)
    for (const name of ['board.json', 'actions.json', 'notes.md']) {
      expect(await stat(flat(name))).toBeTruthy()
    }
  })

  it('is a no-op on a companion that is already folded', async () => {
    await mkdir(projectActiveReviewDir(repo), { recursive: true })
    await writeFile(active('review.json'), '{"name":"new"}')
    expect((await migrateActiveReviewLayout(repo)).moved).toEqual([])
    expect(await readFile(active('review.json'), 'utf8')).toBe('{"name":"new"}')
  })

  it('never clobbers newer data with a stale flat file', async () => {
    await mkdir(projectActiveReviewDir(repo), { recursive: true })
    await writeFile(active('review.json'), '{"name":"new"}')
    await writeFile(flat('review.json'), '{"name":"stale"}')
    await migrateActiveReviewLayout(repo)
    expect(await readFile(active('review.json'), 'utf8')).toBe('{"name":"new"}')
  })

  it('is a no-op on a companion that never had a review', async () => {
    expect((await migrateActiveReviewLayout(repo)).moved).toEqual([])
  })
})
