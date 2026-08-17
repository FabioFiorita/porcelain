// @vitest-environment node
import { publicErrorSchema } from '@porcelain/contracts'
import { describe, expect, it } from 'vitest'
import { normalizePublicError } from '../../daemon-composition/public-error'
import type { ReviewedMark, ReviewMarksGit, ReviewMarksStore } from './review-marks-capabilities'
import { createReviewMarksOperations } from './review-marks-operations'
import { createReviewMarksRouter } from './review-marks-router'

const REQUEST_ID = '00000000-0000-4000-8000-000000000031'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' as const }, requestId: REQUEST_ID }
const REPO = '/synthetic/repo'

/** An in-memory `reviewed.json` with the same read-modify-write semantics as disk. */
function memoryStore(initial: ReviewedMark[] = []): ReviewMarksStore & { marks: ReviewedMark[] } {
  const state = { marks: [...initial] }
  return {
    marks: state.marks,
    read: async () => [...state.marks],
    write: async (_repo, marks) => {
      state.marks.length = 0
      state.marks.push(...[...new Map(marks.map((m) => [m.path, m])).values()])
    },
    remove: async (_repo, marks) => {
      const stale = new Set(marks.map((m) => `${m.path}\0${m.fingerprint}`))
      const survivors = state.marks.filter((m) => !stale.has(`${m.path}\0${m.fingerprint}`))
      state.marks.length = 0
      state.marks.push(...survivors)
    },
  }
}

function fixedGit(fingerprints: Record<string, string>): ReviewMarksGit {
  return {
    fingerprints: async (_repo, paths) =>
      // `path in fingerprints` does not narrow the index read, so filter+map produced a
      // Map<string, string | undefined>. flatMap drops the miss and keeps the value narrowed.
      new Map(
        paths.flatMap((path) => {
          const fingerprint = fingerprints[path]
          return fingerprint === undefined ? [] : [[path, fingerprint] as const]
        }),
      ),
  }
}

function caller(store: ReviewMarksStore, git: ReviewMarksGit) {
  return createReviewMarksRouter(createReviewMarksOperations({ store, git })).createCaller(
    PUBLIC_CONTEXT,
  )
}

describe('review marks router mapping', () => {
  it('setReviewed marks exactly the named paths and is idempotent', async () => {
    const store = memoryStore()
    const api = caller(store, fixedGit({ 'a.ts': 'fp-a', 'b.ts': 'fp-b' }))

    await expect(
      api.setReviewed({ repoPath: REPO, paths: ['a.ts', 'b.ts'], reviewed: true }),
    ).resolves.toBeUndefined()
    expect(store.marks).toEqual([
      { path: 'a.ts', fingerprint: 'fp-a' },
      { path: 'b.ts', fingerprint: 'fp-b' },
    ])

    await api.setReviewed({ repoPath: REPO, paths: ['a.ts', 'b.ts'], reviewed: true })
    expect(store.marks).toEqual([
      { path: 'a.ts', fingerprint: 'fp-a' },
      { path: 'b.ts', fingerprint: 'fp-b' },
    ])
  })

  it('setReviewed with reviewed:false removes exactly the named paths', async () => {
    const store = memoryStore([
      { path: 'a.ts', fingerprint: 'fp-a' },
      { path: 'b.ts', fingerprint: 'fp-b' },
    ])
    const api = caller(store, fixedGit({}))

    await api.setReviewed({ repoPath: REPO, paths: ['a.ts'], reviewed: false })
    expect(store.marks).toEqual([{ path: 'b.ts', fingerprint: 'fp-b' }])

    await api.setReviewed({ repoPath: REPO, paths: ['a.ts'], reviewed: false })
    expect(store.marks).toEqual([{ path: 'b.ts', fingerprint: 'fp-b' }])
  })

  it('reviewedPaths prunes a mark whose fingerprint changed and re-reads after the prune', async () => {
    const store = memoryStore([
      { path: 'a.ts', fingerprint: 'fp-a' },
      { path: 'b.ts', fingerprint: 'fp-b' },
    ])
    const withConcurrentMark: ReviewMarksStore = {
      ...store,
      remove: async (repo, marks) => {
        // A concurrent optimistic tick lands between the snapshot and the prune.
        store.marks.push({ path: 'c.ts', fingerprint: 'fp-c' })
        await store.remove(repo, marks)
      },
    }
    const api = caller(withConcurrentMark, fixedGit({ 'a.ts': 'fp-a', 'b.ts': 'CHANGED' }))

    await expect(api.reviewedPaths(REPO)).resolves.toEqual(['a.ts', 'c.ts'])
  })

  it('reviewedPaths leaves an unfingerprinted mark alone and returns without a write', async () => {
    const store = memoryStore([{ path: 'a.ts', fingerprint: 'fp-a' }])
    const api = caller(
      { ...store, remove: async () => expect.unreachable('nothing is stale') },
      fixedGit({}),
    )
    await expect(api.reviewedPaths(REPO)).resolves.toEqual(['a.ts'])
  })

  it('rejects a malformed input before it reaches an operation', async () => {
    const api = caller(
      {
        read: async () => expect.unreachable('input never parsed'),
        write: async () => expect.unreachable('input never parsed'),
        remove: async () => expect.unreachable('input never parsed'),
      },
      { fingerprints: async () => expect.unreachable('input never parsed') },
    )
    try {
      await api.setReviewed({ repoPath: REPO, paths: [], reviewed: true })
      throw new Error('Expected a tRPC rejection')
    } catch (error) {
      const normalized = normalizePublicError(error, REQUEST_ID)
      expect(normalized.unexpected).toBe(false)
      expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
        code: 'request.invalid',
        requestId: REQUEST_ID,
      })
    }
  })
})
