import type { ReviewComment } from '@porcelain/contracts/review'
import { describe, expect, it } from 'vitest'

import { buildCommentIndex, commentedLinesByPath } from './comment-index'

const comment = (overrides: Partial<ReviewComment>): ReviewComment => ({
  body: 'look here',
  createdAt: 0,
  id: 'c1',
  path: 'src/a.ts',
  resolved: false,
  ...overrides,
})

describe('buildCommentIndex', () => {
  it('keeps only the comments on the file being read', () => {
    const index = buildCommentIndex(
      [comment({ id: 'a', startLine: 1 }), comment({ id: 'b', path: 'src/b.ts', startLine: 1 })],
      'src/a.ts',
    )
    expect((index.byLine.get(1) ?? []).map((entry) => entry.id)).toEqual(['a'])
  })

  it('expands a range so every covered line resolves in one lookup', () => {
    const index = buildCommentIndex([comment({ endLine: 4, startLine: 2 })], 'src/a.ts')
    expect([...index.byLine.keys()]).toEqual([2, 3, 4])
  })

  it('treats a range that ends where it starts as a single line', () => {
    const index = buildCommentIndex([comment({ endLine: 2, startLine: 2 })], 'src/a.ts')
    expect([...index.byLine.keys()]).toEqual([2])
  })

  it('collects a comment with no line as file-level, not line 0', () => {
    const index = buildCommentIndex([comment({})], 'src/a.ts')
    expect(index.fileLevel).toHaveLength(1)
    expect(index.byLine.size).toBe(0)
  })

  it('stacks several comments on the same line', () => {
    const index = buildCommentIndex(
      [comment({ id: 'a', startLine: 3 }), comment({ id: 'b', startLine: 3 })],
      'src/a.ts',
    )
    expect(index.byLine.get(3)).toHaveLength(2)
  })

  it('indexes resolved comments too — the diff still marks a line that was discussed', () => {
    const index = buildCommentIndex([comment({ resolved: true, startLine: 5 })], 'src/a.ts')
    expect(index.byLine.get(5)).toHaveLength(1)
  })
})

describe('commentedLinesByPath', () => {
  it('groups commented lines per file for the stacked read', () => {
    const byPath = commentedLinesByPath([
      comment({ id: 'a', startLine: 2 }),
      comment({ endLine: 5, id: 'b', path: 'src/b.ts', startLine: 4 }),
    ])
    expect([...(byPath.get('src/a.ts') ?? [])]).toEqual([2])
    expect([...(byPath.get('src/b.ts') ?? [])]).toEqual([4, 5])
  })

  it('skips whole-file comments, which mark no line', () => {
    expect(commentedLinesByPath([comment({})]).size).toBe(0)
  })
})
