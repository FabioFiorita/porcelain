import type { ReviewComment } from '@porcelain/contracts/review'
import { describe, expect, it } from 'vitest'

import {
  commentAnchorKey,
  commentCounts,
  commentRange,
  commentThreads,
  describeAnchor,
  describeCommentCounts,
} from './comment-threads'

function comment(overrides: Partial<ReviewComment> & { id: string }): ReviewComment {
  return {
    body: 'body',
    createdAt: 1,
    path: 'src/a.ts',
    resolved: false,
    ...overrides,
  }
}

describe('commentRange', () => {
  it('is null for a comment on the whole file', () => {
    expect(commentRange(comment({ id: 'c1' }))).toBeNull()
  })

  it('treats a missing end line as a one-line range', () => {
    expect(commentRange(comment({ id: 'c1', startLine: 7 }))).toEqual({ endLine: 7, startLine: 7 })
  })

  it('keeps both bounds of a range', () => {
    expect(commentRange(comment({ endLine: 9, id: 'c1', startLine: 7 }))).toEqual({
      endLine: 9,
      startLine: 7,
    })
  })
})

describe('commentAnchorKey', () => {
  it('gives a single-line comment and the same range written out the same key', () => {
    expect(commentAnchorKey(comment({ id: 'a', startLine: 7 }))).toBe(
      commentAnchorKey(comment({ endLine: 7, id: 'b', startLine: 7 })),
    )
  })

  it('cannot be confused by a path that contains the separator characters', () => {
    expect(commentAnchorKey(comment({ id: 'a', path: 'a 3-3', startLine: 1 }))).not.toBe(
      commentAnchorKey(comment({ id: 'b', path: 'a', startLine: 3 })),
    )
  })

  it('separates the same lines in two files', () => {
    expect(commentAnchorKey(comment({ id: 'a', startLine: 7 }))).not.toBe(
      commentAnchorKey(comment({ id: 'b', path: 'src/b.ts', startLine: 7 })),
    )
  })

  it('separates a file-level comment from a comment on line 1', () => {
    expect(commentAnchorKey(comment({ id: 'a' }))).not.toBe(
      commentAnchorKey(comment({ id: 'b', startLine: 1 })),
    )
  })
})

describe('describeAnchor', () => {
  it('names the whole-file case', () => {
    expect(describeAnchor(null)).toBe('File comment')
  })

  it('names one line and a span', () => {
    expect(describeAnchor({ endLine: 7, startLine: 7 })).toBe('Line 7')
    expect(describeAnchor({ endLine: 9, startLine: 7 })).toBe('Lines 7–9')
  })
})

describe('commentThreads', () => {
  it('collects every comment on one anchor into a single thread', () => {
    const threads = commentThreads([
      comment({ body: 'second', id: 'b', startLine: 3 }),
      comment({ body: 'first', id: 'a', startLine: 3 }),
    ])
    expect(threads).toHaveLength(1)
    expect(threads[0]?.comments.map((entry) => entry.body)).toEqual(['first', 'second'])
  })

  it('keeps old and new sides and comparison scopes distinct at the same line', () => {
    const scoped = (side: 'old' | 'new', base: string): ReviewComment => ({
      body: side,
      createdAt: 1,
      id: `${side}-${base}`,
      resolved: false,
      anchor: {
        kind: 'file',
        path: 'src/a.ts',
        startLine: 7,
        side,
        scope: { type: 'branch', base },
      },
    })
    expect(commentAnchorKey(scoped('old', 'main'))).not.toBe(
      commentAnchorKey(scoped('new', 'main')),
    )
    expect(commentAnchorKey(scoped('new', 'main'))).not.toBe(
      commentAnchorKey(scoped('new', 'develop')),
    )
  })

  it('reads a thread oldest first, so a reply follows what it answers', () => {
    const threads = commentThreads([
      comment({ body: 'newest', createdAt: 3, id: 'c', startLine: 3 }),
      comment({ body: 'oldest', createdAt: 1, id: 'a', startLine: 3 }),
    ])
    expect(threads[0]?.comments[0]?.body).toBe('oldest')
  })

  it('keeps the daemon order between threads, so recent activity stays on top', () => {
    const threads = commentThreads([
      comment({ id: 'b', startLine: 9 }),
      comment({ id: 'a', startLine: 3 }),
    ])
    expect(threads.map((thread) => thread.key)).toEqual(['src/a.ts\u00009-9', 'src/a.ts\u00003-3'])
  })

  it('keeps a file-level thread apart from the ranges in the same file', () => {
    const threads = commentThreads([comment({ id: 'file' }), comment({ id: 'line', startLine: 3 })])
    expect(threads).toHaveLength(2)
    expect(threads[0]?.range).toBeNull()
    expect(threads[1]?.range).toEqual({ endLine: 3, startLine: 3 })
  })

  it('carries the path of the anchor it grouped', () => {
    const threads = commentThreads([comment({ id: 'a', path: 'src/b.ts', startLine: 2 })])
    expect(threads[0]?.path).toBe('src/b.ts')
  })

  it('is empty for an empty list', () => {
    expect(commentThreads([])).toEqual([])
  })
})

describe('commentCounts', () => {
  it('splits open from resolved', () => {
    expect(
      commentCounts([
        comment({ id: 'a' }),
        comment({ id: 'b', resolved: true }),
        comment({ id: 'c' }),
      ]),
    ).toEqual({ open: 2, resolved: 1 })
  })

  it('counts nothing as nothing', () => {
    expect(commentCounts([])).toEqual({ open: 0, resolved: 0 })
  })
})

describe('describeCommentCounts', () => {
  it('says there is no review to answer rather than counting to zero', () => {
    expect(describeCommentCounts([])).toBe('No comments yet')
  })

  it('reads the way the web Changes header does', () => {
    expect(
      describeCommentCounts([comment({ id: 'a' }), comment({ id: 'b', resolved: true })]),
    ).toBe('1 open · 1 resolved')
  })
})
