import type { ReviewComment } from '@backend/comment-store'
import { describe, expect, it } from 'vitest'
import { buildCommentIndex } from './use-comments'

function comment(overrides: Partial<ReviewComment>): ReviewComment {
  return {
    id: 'c1',
    path: 'src/a.ts',
    body: 'note',
    resolved: false,
    createdAt: 0,
    ...overrides,
  }
}

describe('buildCommentIndex', () => {
  it('keeps only comments for the requested file', () => {
    const index = buildCommentIndex(
      [
        comment({ id: 'a', path: 'src/a.ts', startLine: 1 }),
        comment({ id: 'b', path: 'src/b.ts', startLine: 1 }),
      ],
      'src/a.ts',
    )
    expect(index.byLine.get(1)?.map((c) => c.id)).toEqual(['a'])
    expect(index.fileLevel).toEqual([])
  })

  it('expands a line range into every line it covers', () => {
    const c = comment({ id: 'r', path: 'src/a.ts', startLine: 3, endLine: 5 })
    const index = buildCommentIndex([c], 'src/a.ts')
    expect(index.byLine.get(2)).toBeUndefined()
    expect(index.byLine.get(3)).toEqual([c])
    expect(index.byLine.get(4)).toEqual([c])
    expect(index.byLine.get(5)).toEqual([c])
    expect(index.byLine.get(6)).toBeUndefined()
  })

  it('treats a single-line comment (no endLine) as one line', () => {
    const c = comment({ id: 's', path: 'src/a.ts', startLine: 7 })
    const index = buildCommentIndex([c], 'src/a.ts')
    expect([...index.byLine.keys()]).toEqual([7])
  })

  it('collects several comments on the same line, preserving order', () => {
    const first = comment({ id: '1', path: 'src/a.ts', startLine: 2 })
    const second = comment({ id: '2', path: 'src/a.ts', startLine: 2 })
    const index = buildCommentIndex([first, second], 'src/a.ts')
    expect(index.byLine.get(2)?.map((c) => c.id)).toEqual(['1', '2'])
  })

  it('routes comments without a startLine to fileLevel', () => {
    const c = comment({ id: 'file', path: 'src/a.ts' })
    const index = buildCommentIndex([c], 'src/a.ts')
    expect(index.fileLevel.map((x) => x.id)).toEqual(['file'])
    expect(index.byLine.size).toBe(0)
  })
})
