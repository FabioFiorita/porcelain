import { describe, expect, it } from 'vitest'
import {
  COMMENTS_FILE_VERSION,
  CommentsFileParseError,
  emptyCommentsFileV1,
  parseCommentsFileV1,
  planAddReviewComment,
  planAnswerReviewComment,
  planClearResolvedReviewComments,
  planDeleteReviewComment,
  planEditReviewComment,
  planSetReviewCommentResolved,
  serializeCommentsFileV1,
  sortComments,
} from './comments-file'

const ID_A = 'comment-a'
const ID_B = 'comment-b'
const ID_C = 'comment-c'

function comment(
  overrides: Partial<{
    id: string
    path: string
    startLine: number
    endLine: number
    anchorText: string
    body: string
    author: 'user' | 'agent'
    resolved: boolean
    createdAt: number
    agentReply: { body: string; createdAt: number }
  }> = {},
) {
  return {
    id: overrides.id ?? ID_A,
    path: overrides.path ?? 'src/a.ts',
    body: overrides.body ?? 'note',
    ...(overrides.author !== undefined ? { author: overrides.author } : {}),
    resolved: overrides.resolved ?? false,
    createdAt: overrides.createdAt ?? 10,
    ...(overrides.startLine !== undefined ? { startLine: overrides.startLine } : {}),
    ...(overrides.endLine !== undefined ? { endLine: overrides.endLine } : {}),
    ...(overrides.anchorText !== undefined ? { anchorText: overrides.anchorText } : {}),
    ...(overrides.agentReply !== undefined ? { agentReply: overrides.agentReply } : {}),
  }
}

describe('parseCommentsFileV1 / serializeCommentsFileV1', () => {
  it('accepts empty v1 and round-trips', () => {
    const empty = emptyCommentsFileV1()
    expect(empty).toEqual({ version: 1, comments: [] })
    expect(parseCommentsFileV1(empty)).toEqual(empty)
    expect(serializeCommentsFileV1(empty)).toBe(`${JSON.stringify(empty, null, 2)}\n`)
  })

  it('accepts a complete comment set and rejects unknown fields', () => {
    const file = {
      version: COMMENTS_FILE_VERSION,
      comments: [
        comment({
          startLine: 1,
          endLine: 2,
          anchorText: 'fn()',
          agentReply: { body: 'yes', createdAt: 20 },
        }),
        comment({ id: ID_B, path: 'src/b.ts', createdAt: 30 }),
      ],
    }
    expect(parseCommentsFileV1(file).comments).toHaveLength(2)
    expect(() => parseCommentsFileV1({ ...file, extra: true })).toThrow(CommentsFileParseError)
    expect(() =>
      parseCommentsFileV1({
        version: 1,
        comments: [{ ...comment(), extra: true }],
      }),
    ).toThrow(/unknown field/)
  })

  it('preserves explicit authorship while accepting legacy user comments without it', () => {
    const legacy = comment()
    const agent = comment({ author: 'agent', id: ID_B })
    expect(parseCommentsFileV1({ version: 1, comments: [legacy, agent] }).comments).toEqual([
      legacy,
      agent,
    ])
    expect(() =>
      parseCommentsFileV1({ version: 1, comments: [{ ...legacy, author: 'robot' }] }),
    ).toThrow(/author is invalid/)
  })

  it('rejects top-level arrays, incompatible version, and malformed shapes', () => {
    expect(() => parseCommentsFileV1([])).toThrow(/top-level arrays/)
    expect(() => parseCommentsFileV1({ version: 2, comments: [] })).toThrow(
      /unsupported Comments file version/,
    )
    expect(() => parseCommentsFileV1({ version: 1 })).toThrow(/comments must be an array/)
    expect(() => parseCommentsFileV1({ comments: [] })).toThrow(/version is required/)
  })

  it('rejects duplicate IDs, empty ids/paths, and invalid line numbers', () => {
    expect(() =>
      parseCommentsFileV1({
        version: 1,
        comments: [comment(), comment({ id: ID_A, path: 'other.ts' })],
      }),
    ).toThrow(/duplicate/)
    expect(() => parseCommentsFileV1({ version: 1, comments: [comment({ id: '' })] })).toThrow(
      /id is invalid/,
    )
    expect(() => parseCommentsFileV1({ version: 1, comments: [comment({ path: '' })] })).toThrow(
      /path is invalid/,
    )
    expect(() =>
      parseCommentsFileV1({
        version: 1,
        comments: [{ ...comment(), startLine: 0 }],
      }),
    ).toThrow(/startLine/)
    expect(() =>
      parseCommentsFileV1({
        version: 1,
        comments: [{ ...comment(), resolved: 'false' }],
      }),
    ).toThrow(/resolved/)
  })
})

describe('sortComments', () => {
  it('orders by createdAt descending then id ascending', () => {
    const sorted = sortComments([
      comment({ id: ID_B, createdAt: 10 }),
      comment({ id: ID_A, createdAt: 20 }),
      comment({ id: ID_C, createdAt: 10 }),
    ])
    expect(sorted.map((c) => c.id)).toEqual([ID_A, ID_B, ID_C])
  })
})

describe('comment planners', () => {
  it('adds with resolved false and rejects inverted ranges', () => {
    const empty = emptyCommentsFileV1()
    const added = planAddReviewComment(empty, {
      id: ID_A,
      author: 'agent',
      path: 'a.ts',
      body: 'why?',
      startLine: 2,
      endLine: 5,
      createdAt: 1,
    })
    expect(added.ok).toBe(true)
    if (!added.ok) return
    expect(added.comment.resolved).toBe(false)
    expect(added.comment.author).toBe('agent')
    expect(added.comment.startLine).toBe(2)

    const inverted = planAddReviewComment(empty, {
      id: ID_A,
      path: 'a.ts',
      body: 'why?',
      startLine: 5,
      endLine: 2,
      createdAt: 1,
    })
    expect(inverted).toEqual({ ok: false, error: { code: 'request.invalid' } })
  })

  it('edits body, preserves agentReply, and rejects missing ids', () => {
    const base = {
      version: 1 as const,
      comments: [
        comment({
          agentReply: { body: 'kept', createdAt: 9 },
        }),
      ],
    }
    const edited = planEditReviewComment(base, { commentId: ID_A, body: 'new body' })
    expect(edited.ok).toBe(true)
    if (!edited.ok) return
    expect(edited.comment.body).toBe('new body')
    expect(edited.comment.agentReply).toEqual({ body: 'kept', createdAt: 9 })

    expect(planEditReviewComment(base, { commentId: 'missing', body: 'x' })).toEqual({
      ok: false,
      error: { code: 'review.comment-not-found', commentId: 'missing' },
    })
  })

  it('deletes, resolves, and clears only resolved comments', () => {
    const base = {
      version: 1 as const,
      comments: [
        comment({ id: ID_A, resolved: false }),
        comment({ id: ID_B, resolved: true, createdAt: 20 }),
      ],
    }

    const deleted = planDeleteReviewComment(base, { commentId: ID_A })
    expect(deleted.ok).toBe(true)
    if (!deleted.ok) return
    expect(deleted.file.comments.map((c) => c.id)).toEqual([ID_B])

    expect(planDeleteReviewComment(base, { commentId: 'nope' })).toEqual({
      ok: false,
      error: { code: 'review.comment-not-found', commentId: 'nope' },
    })

    const resolved = planSetReviewCommentResolved(base, {
      commentId: ID_A,
      resolved: true,
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.comment.resolved).toBe(true)

    const cleared = planClearResolvedReviewComments(base)
    expect(cleared.removedIds).toEqual([ID_B])
    expect(cleared.file.comments.map((c) => c.id)).toEqual([ID_A])

    const emptyClear = planClearResolvedReviewComments(emptyCommentsFileV1())
    expect(emptyClear.removedIds).toEqual([])
  })

  it('answers attach agentReply and preserve it across resolve', () => {
    const base = { version: 1 as const, comments: [comment()] }
    const answered = planAnswerReviewComment(base, {
      commentId: ID_A,
      body: 'because',
      createdAt: 99,
    })
    expect(answered.ok).toBe(true)
    if (!answered.ok) return
    expect(answered.comment.agentReply).toEqual({ body: 'because', createdAt: 99 })

    const resolved = planSetReviewCommentResolved(answered.file, {
      commentId: ID_A,
      resolved: true,
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.comment.agentReply).toEqual({ body: 'because', createdAt: 99 })
  })
})
