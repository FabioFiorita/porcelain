import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearReviewSet, isRepoContained, readReviewSet } from './review-store'

describe('clearReviewSet', () => {
  const file = join(tmpdir(), 'porcelain-review-store-test', 'review-sets.json')
  const write = (data: unknown): void => {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(data))
  }
  const read = (): Record<string, unknown> => JSON.parse(readFileSync(file, 'utf8'))

  beforeEach(() => {
    process.env.PORCELAIN_REVIEW_SETS = file
    rmSync(dirname(file), { recursive: true, force: true })
  })
  afterEach(() => {
    delete process.env.PORCELAIN_REVIEW_SETS
    rmSync(dirname(file), { recursive: true, force: true })
  })

  it('removes only the target repo, leaving the others', async () => {
    write({
      '/repo': { name: 'A', files: [{ path: 'a.ts' }] },
      '/other': { name: 'B', files: [{ path: 'b.ts' }] },
    })
    await clearReviewSet('/repo')
    const all = read()
    expect(all['/repo']).toBeUndefined()
    expect(all['/other']).toBeDefined()
  })

  it('is a no-op when the repo has no set', async () => {
    write({ '/other': { name: 'B', files: [] } })
    await clearReviewSet('/repo')
    expect(read()['/other']).toBeDefined()
  })

  it('is a no-op (no throw) when the file is absent', async () => {
    await expect(clearReviewSet('/repo')).resolves.toBeUndefined()
  })
})

describe('isRepoContained', () => {
  it('accepts repo-relative paths', () => {
    expect(isRepoContained('/repo', 'src/a.ts')).toBe(true)
    expect(isRepoContained('/repo', 'a/../b.ts')).toBe(true) // normalizes inside
  })
  it('rejects absolute paths and parent escapes', () => {
    expect(isRepoContained('/repo', '/etc/passwd')).toBe(false)
    expect(isRepoContained('/repo', '../../../etc/passwd')).toBe(false)
    expect(isRepoContained('/repo', '.')).toBe(false) // the repo dir itself, not a file
  })
})

describe('readReviewSet path containment', () => {
  const file = join(tmpdir(), 'porcelain-review-store-containment-test', 'review-sets.json')
  const write = (data: unknown): void => {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(data))
  }

  beforeEach(() => {
    process.env.PORCELAIN_REVIEW_SETS = file
    rmSync(dirname(file), { recursive: true, force: true })
  })
  afterEach(() => {
    delete process.env.PORCELAIN_REVIEW_SETS
    rmSync(dirname(file), { recursive: true, force: true })
  })

  it('drops review-set entries that escape the repo', async () => {
    write({
      '/repo': {
        name: 'test',
        files: [
          { path: 'src/a.ts', source: 'changed' },
          { path: '../../secret', source: 'changed' },
          { path: '/etc/passwd', source: 'context' },
        ],
      },
    })
    const set = await readReviewSet('/repo')
    expect(set?.files.map((f) => f.path)).toEqual(['src/a.ts'])
  })

  it('returns null when all entries escape the repo', async () => {
    write({
      '/repo': {
        name: 'test',
        files: [
          { path: '../outside.ts', source: 'changed' },
          { path: '/absolute/path.ts', source: 'context' },
        ],
      },
    })
    const set = await readReviewSet('/repo')
    expect(set?.files).toEqual([])
  })
})

describe('readReviewSet sections', () => {
  const file = join(tmpdir(), 'porcelain-review-store-sections-test', 'review-sets.json')
  const write = (data: unknown): void => {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(data))
  }

  beforeEach(() => {
    process.env.PORCELAIN_REVIEW_SETS = file
    rmSync(dirname(file), { recursive: true, force: true })
  })
  afterEach(() => {
    delete process.env.PORCELAIN_REVIEW_SETS
    rmSync(dirname(file), { recursive: true, force: true })
  })

  it('parses thesis and sections, defaulting them when absent', async () => {
    write({
      '/repo': {
        name: 'Login flow',
        thesis: 'One round-trip instead of three.',
        files: [{ path: 'a.ts' }],
        sections: [
          {
            title: 'Entry',
            prose: 'starts here',
            diagram: '<svg />',
            anchors: [{ path: 'a.ts', startLine: 1, endLine: 9 }],
          },
        ],
      },
      '/bare': { name: 'x', files: [] },
    })
    const set = await readReviewSet('/repo')
    expect(set?.thesis).toBe('One round-trip instead of three.')
    expect(set?.sections).toEqual([
      {
        title: 'Entry',
        prose: 'starts here',
        diagram: '<svg />',
        anchors: [{ path: 'a.ts', startLine: 1, endLine: 9 }],
      },
    ])
    const bare = await readReviewSet('/bare')
    expect(bare?.sections).toEqual([])
    expect(bare?.thesis).toBeUndefined()
  })

  it('drops an invalid section but keeps the valid ones (never throws)', async () => {
    write({
      '/repo': {
        name: 'test',
        files: [{ path: 'a.ts' }],
        sections: [
          { title: 'Good', prose: 'kept', anchors: [] },
          { title: '', prose: 'empty title fails min(1)' },
          { title: 'No prose at all' },
          { title: 'Oversized', prose: 'x'.repeat(32_769) },
        ],
      },
    })
    const set = await readReviewSet('/repo')
    expect(set?.sections.map((s) => s.title)).toEqual(['Good'])
    expect(set?.files).toEqual([{ path: 'a.ts' }])
  })

  it('filters anchors that escape the repo, exactly like file paths', async () => {
    write({
      '/repo': {
        name: 'test',
        files: [],
        sections: [
          {
            title: 'Entry',
            prose: 'x',
            anchors: [
              { path: 'src/a.ts' },
              { path: '../../etc/passwd' },
              { path: '/etc/passwd', startLine: 1 },
            ],
          },
        ],
      },
    })
    const set = await readReviewSet('/repo')
    expect(set?.sections[0]?.anchors).toEqual([{ path: 'src/a.ts' }])
  })

  it('caps the sections at 30', async () => {
    write({
      '/repo': {
        name: 'test',
        files: [],
        sections: Array.from({ length: 35 }, (_, i) => ({ title: `S${i}`, prose: '' })),
      },
    })
    const set = await readReviewSet('/repo')
    expect(set?.sections).toHaveLength(30)
    expect(set?.sections.at(-1)?.title).toBe('S29')
  })
})
