// @vitest-environment node
import { type CommentsFileV1, emptyCommentsFileV1 } from '@porcelain/shared/comments-file'
import { describe, expect, it } from 'vitest'
import type {
  ReviewCommentChanges,
  ReviewCommentStore,
  ReviewCommentStoreResult,
  ReviewCommentTransactResult,
} from './comment-capabilities'
import { createReviewCommentOperations } from './comment-operations'

const PROJECT = '/synthetic/repo'
const ID_A = 'comment-a'

function memoryStore(initial: CommentsFileV1 = emptyCommentsFileV1()): {
  store: ReviewCommentStore
  files: Map<string, CommentsFileV1>
  reads: number
  writes: number
} {
  const files = new Map<string, CommentsFileV1>([[PROJECT, initial]])
  let reads = 0
  let writes = 0

  const store: ReviewCommentStore = {
    async read(projectPath) {
      reads += 1
      const file = files.get(projectPath) ?? emptyCommentsFileV1()
      return { ok: true, value: structuredClone(file) }
    },
    async transact(projectPath, change) {
      reads += 1
      const current = files.get(projectPath) ?? emptyCommentsFileV1()
      const planned = change(structuredClone(current))
      if (!planned.ok) return planned
      writes += 1
      files.set(projectPath, structuredClone(planned.value.file))
      return planned
    },
  }

  return {
    store,
    files,
    get reads() {
      return reads
    },
    get writes() {
      return writes
    },
  }
}

function recordingChanges(): { changes: ReviewCommentChanges; events: string[] } {
  const events: string[] = []
  return {
    events,
    changes: {
      publish(change) {
        events.push(`${change.type}:${change.projectPath}`)
      },
    },
  }
}

describe('review comment operations', () => {
  it('lists, adds, edits, resolves, clears, and deletes with one notification per durable write', async () => {
    const mem = memoryStore()
    const { changes, events } = recordingChanges()
    let tick = 100
    let n = 0
    const ops = createReviewCommentOperations({
      store: mem.store,
      clock: {
        now: () => {
          tick += 1
          return tick
        },
      },
      ids: {
        create: () => {
          n += 1
          return `comment-${String(n).padStart(2, '0')}`
        },
      },
      changes,
    })

    expect(await ops.listReviewComments({ projectPath: PROJECT })).toEqual({
      ok: true,
      value: [],
    })
    expect(events).toEqual([])

    const added = await ops.addReviewComment({
      projectPath: PROJECT,
      author: 'agent',
      path: 'src/a.ts',
      body: 'look here',
      startLine: 1,
      endLine: 2,
    })
    expect(added.ok).toBe(true)
    if (!added.ok) return
    expect(added.value).toMatchObject({
      path: 'src/a.ts',
      body: 'look here',
      author: 'agent',
      resolved: false,
      startLine: 1,
      endLine: 2,
    })
    expect(events).toEqual([`review.changed:${PROJECT}`])

    const edited = await ops.editReviewComment({
      projectPath: PROJECT,
      commentId: added.value.id,
      body: 'updated',
    })
    expect(edited).toEqual({ ok: true, value: undefined })

    const resolved = await ops.resolveReviewComment({
      projectPath: PROJECT,
      commentId: added.value.id,
      resolved: true,
    })
    expect(resolved).toEqual({ ok: true, value: undefined })

    const cleared = await ops.clearResolvedReviewComments({ projectPath: PROJECT })
    expect(cleared).toEqual({ ok: true, value: undefined })

    const again = await ops.addReviewComment({
      projectPath: PROJECT,
      path: 'src/b.ts',
      body: 'temp',
    })
    if (!again.ok) return
    const deleted = await ops.deleteReviewComment({
      projectPath: PROJECT,
      commentId: again.value.id,
    })
    expect(deleted).toEqual({ ok: true, value: undefined })

    // add, edit, resolve, clear, add-again, delete
    expect(events).toHaveLength(6)
    expect(await ops.listReviewComments({ projectPath: PROJECT })).toEqual({
      ok: true,
      value: [],
    })
  })

  it('rejects inverted ranges and missing ids without writing or notifying', async () => {
    const mem = memoryStore()
    const { changes, events } = recordingChanges()
    const ops = createReviewCommentOperations({
      store: mem.store,
      clock: { now: () => 1 },
      ids: { create: () => ID_A },
      changes,
    })

    const inverted = await ops.addReviewComment({
      projectPath: PROJECT,
      path: 'a.ts',
      body: 'x',
      startLine: 5,
      endLine: 2,
    })
    expect(inverted).toEqual({ ok: false, error: { code: 'request.invalid' } })
    expect(mem.writes).toBe(0)
    expect(events).toEqual([])

    expect(
      await ops.editReviewComment({ projectPath: PROJECT, commentId: ID_A, body: 'x' }),
    ).toEqual({
      ok: false,
      error: { code: 'review.comment-not-found', commentId: ID_A },
    })
    expect(await ops.deleteReviewComment({ projectPath: PROJECT, commentId: ID_A })).toEqual({
      ok: false,
      error: { code: 'review.comment-not-found', commentId: ID_A },
    })
    expect(
      await ops.resolveReviewComment({
        projectPath: PROJECT,
        commentId: ID_A,
        resolved: true,
      }),
    ).toEqual({
      ok: false,
      error: { code: 'review.comment-not-found', commentId: ID_A },
    })
    expect(mem.writes).toBe(0)
    expect(events).toEqual([])
  })

  it('surfaces adapter unavailable and never notifies on store failure', async () => {
    const { changes, events } = recordingChanges()
    const store: ReviewCommentStore = {
      async read(): Promise<ReviewCommentStoreResult<CommentsFileV1>> {
        return { ok: false, error: { code: 'review.unavailable' } }
      },
      async transact(): Promise<ReviewCommentTransactResult> {
        return { ok: false, error: { code: 'review.unavailable' } }
      },
    }
    const ops = createReviewCommentOperations({
      store,
      clock: { now: () => 1 },
      ids: { create: () => ID_A },
      changes,
    })

    expect(await ops.listReviewComments({ projectPath: PROJECT })).toEqual({
      ok: false,
      error: { code: 'review.unavailable' },
    })
    expect(await ops.addReviewComment({ projectPath: PROJECT, path: 'a.ts', body: 'x' })).toEqual({
      ok: false,
      error: { code: 'review.unavailable' },
    })
    expect(events).toEqual([])
  })

  it('empty clear succeeds and still notifies once', async () => {
    const mem = memoryStore()
    const { changes, events } = recordingChanges()
    const ops = createReviewCommentOperations({ store: mem.store, changes })
    const cleared = await ops.clearResolvedReviewComments({ projectPath: PROJECT })
    expect(cleared).toEqual({ ok: true, value: undefined })
    expect(events).toEqual([`review.changed:${PROJECT}`])
  })
})
