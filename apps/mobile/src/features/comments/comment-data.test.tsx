import { publicErrorFixtures } from '@porcelain/contracts'
import type { ReviewComment } from '@porcelain/contracts/review'
import { reviewContractFixtures } from '@porcelain/contracts/review'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCommentActions, useReviewComments } from './comment-data'
import { reviewCommentsQueryKey } from './comment-query-key'
import {
  COMMENTS,
  createCommentHarness,
  deferred,
  ENV_ID,
  PAIRED_ENV,
  REPO,
  type TestDaemonClient,
  type TestPairedEnvironment,
} from './test-support'

/** Fixture-shaped public error with a widened message field so tests can vary the surface text. */
const UNAVAILABLE = {
  ...publicErrorFixtures['review.unavailable'],
  message: publicErrorFixtures['review.unavailable'].message as string,
}

const rawFixture = reviewContractFixtures.reviewComments.output[0]
if (rawFixture === undefined) throw new Error('Expected reviewComments fixture')
/** Schema-level ReviewComment so optimistic overrides typecheck under mobile-tests tsc. */
const FIXTURE: ReviewComment = rawFixture
const CREATED: ReviewComment = reviewContractFixtures.addReviewComment.output

const ctx = vi.hoisted(() => ({
  client: null as TestDaemonClient | null,
  env: null as TestPairedEnvironment | null,
  repoPath: '/synthetic/repo' as string | null,
}))

vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: (): TestDaemonClient => {
    if (ctx.client === null) throw new Error('test client not installed')
    return ctx.client
  },
}))

vi.mock('@/lib/daemon/repo', () => ({
  useActiveRepo: () => (ctx.repoPath === null ? null : { path: ctx.repoPath, name: 'repo' }),
}))

vi.mock('@/lib/daemon/environments-store', () => ({
  useActiveEnvironment: () => ctx.env,
}))

type Combined = { list: ReturnType<typeof useReviewComments> } & ReturnType<
  typeof useCommentActions
>

/**
 * Comments load freely until `holdRefetch` is set; then reviewComments waits on
 * `refetch` so only the optimistic rollback can restore pre-mutation cache values
 * before the authoritative settle.
 */
function comments(served: readonly ReviewComment[]) {
  const write = deferred<{ ok: true; value: unknown } | { ok: false; error: typeof UNAVAILABLE }>()
  const refetch = deferred<void>()
  const inputs: unknown[] = []
  let list: ReviewComment[] = served.map((c) => ({ ...c }))
  let holdRefetch = false

  const { mock, client, wrapper } = createCommentHarness({
    reviewComments: async () => {
      if (holdRefetch) await refetch.promise
      return { ok: true, value: list.map((c) => ({ ...c })) }
    },
    addReviewComment: async (input) => {
      inputs.push(input)
      return (await write.promise) as
        | { ok: true; value: ReviewComment }
        | { ok: false; error: typeof UNAVAILABLE }
    },
    editReviewComment: async (input) => {
      inputs.push(input)
      return (await write.promise) as
        | { ok: true; value: undefined }
        | { ok: false; error: typeof UNAVAILABLE }
    },
    deleteReviewComment: async () =>
      (await write.promise) as
        | { ok: true; value: undefined }
        | { ok: false; error: typeof UNAVAILABLE },
    resolveReviewComment: async () =>
      (await write.promise) as
        | { ok: true; value: undefined }
        | { ok: false; error: typeof UNAVAILABLE },
    clearResolvedReviewComments: async () =>
      (await write.promise) as
        | { ok: true; value: undefined }
        | { ok: false; error: typeof UNAVAILABLE },
  })
  ctx.client = client

  const mount = async (): Promise<{ current: Combined }> => {
    const hook = renderHook(
      () => ({
        list: useReviewComments(true),
        ...useCommentActions(),
      }),
      { wrapper },
    )
    await waitFor(() => expect(hook.result.current.list).toEqual(served.map((c) => ({ ...c }))))
    holdRefetch = true
    return hook.result
  }

  return {
    inputs,
    mock,
    write,
    refetch,
    setAuthoritative: (next: readonly ReviewComment[]) => {
      list = next.map((c) => ({ ...c }))
    },
    mount,
  }
}

beforeEach(() => {
  ctx.client = null
  ctx.env = { ...PAIRED_ENV }
  ctx.repoPath = REPO
})

describe('useReviewComments', () => {
  it('queries reviewComments for the active Project/environment key', async () => {
    const list = reviewContractFixtures.reviewComments.output
    const { mock, client, wrapper } = createCommentHarness({
      reviewComments: (input) => {
        expect(input).toBe(REPO)
        return { ok: true, value: list }
      },
    })
    ctx.client = client

    const { result } = renderHook(() => useReviewComments(true), { wrapper })
    await waitFor(() => expect(result.current).toEqual(list))

    expect(mock.requests().filter((r) => r.procedure === 'reviewComments')).toContainEqual({
      procedure: 'reviewComments',
      kind: 'query',
      input: REPO,
    })
    expect(reviewCommentsQueryKey(ENV_ID, REPO)).toEqual([
      'daemon',
      ENV_ID,
      { domain: 'review', name: 'comments', projectPath: REPO },
    ])
  })

  it('returns empty list when inactive, no Project, or never loaded', async () => {
    const { client, wrapper } = createCommentHarness({
      reviewComments: () => ({ ok: true, value: COMMENTS }),
    })
    ctx.client = client

    const inactive = renderHook(() => useReviewComments(false), { wrapper })
    expect(inactive.result.current).toEqual([])

    ctx.repoPath = null
    const noRepo = renderHook(() => useReviewComments(true), { wrapper })
    expect(noRepo.result.current).toEqual([])
  })

  it('returns empty list for a contract-valid empty response', async () => {
    const { client, wrapper } = createCommentHarness({
      reviewComments: () => ({ ok: true, value: [] }),
    })
    ctx.client = client
    const { result } = renderHook(() => useReviewComments(true), { wrapper })
    await waitFor(() => expect(result.current).toEqual([]))
  })
})

describe('useCommentActions optimism', () => {
  it('serializes overlapping writes for one comments identity before applying optimism', async () => {
    const existing = { ...FIXTURE, body: 'original' }
    const { inputs, write, refetch, setAuthoritative, mount } = comments([existing])
    const result = await mount()

    let first!: Promise<void>
    let second!: Promise<void>
    act(() => {
      first = result.current.edit(existing.id, 'first edit')
      second = result.current.edit(existing.id, 'second edit')
    })

    await waitFor(() => expect(result.current.list[0]?.body).toBe('first edit'))
    expect(inputs).toEqual([{ repoPath: REPO, id: existing.id, body: 'first edit' }])

    setAuthoritative([{ ...existing, body: 'second edit' }])
    write.resolve({ ok: true, value: undefined })
    refetch.resolve()
    await Promise.all([first, second])

    expect(inputs).toEqual([
      { repoPath: REPO, id: existing.id, body: 'first edit' },
      { repoPath: REPO, id: existing.id, body: 'second edit' },
    ])
  })

  it('closes a comment in the cache before the server answers, then reconciles', async () => {
    const open = { ...FIXTURE, resolved: false }
    const { write, refetch, setAuthoritative, mount } = comments([open])
    const result = await mount()

    let resolving!: Promise<void>
    act(() => {
      resolving = result.current.setResolved(open.id, true)
    })
    await waitFor(() => expect(result.current.list[0]?.resolved).toBe(true))

    setAuthoritative([{ ...open, resolved: true }])
    write.resolve({ ok: true, value: undefined })
    refetch.resolve()
    await resolving
    await waitFor(() => expect(result.current.list).toEqual([{ ...open, resolved: true }]))
  })

  it('restores the previous list when resolve fails with review.unavailable', async () => {
    const open = { ...FIXTURE, resolved: false }
    const { write, refetch, mount } = comments([open])
    const result = await mount()

    let resolving!: Promise<void>
    act(() => {
      resolving = result.current.setResolved(open.id, true)
    })
    await waitFor(() => expect(result.current.list[0]?.resolved).toBe(true))

    write.resolve({ ok: false, error: { ...UNAVAILABLE, message: 'daemon down' } })
    await waitFor(() => expect(result.current.list).toEqual([open]))

    refetch.resolve()
    await expect(resolving).rejects.toThrow()
  })

  it('prepends an added comment under a temporary id that is never sent to the daemon', async () => {
    const existing = { ...FIXTURE }
    const { inputs, write, refetch, setAuthoritative, mount } = comments([existing])
    const result = await mount()

    let adding!: Promise<void>
    act(() => {
      adding = result.current.add({ path: 'src/b.ts', startLine: 4, body: 'look here' })
    })
    await waitFor(() => expect(result.current.list).toHaveLength(2))
    expect(result.current.list[0]?.body).toBe('look here')
    expect(result.current.list[0]?.startLine).toBe(4)
    expect(result.current.list[0]?.id).toMatch(/^optimistic-/)
    expect(inputs).toEqual([{ repoPath: REPO, path: 'src/b.ts', startLine: 4, body: 'look here' }])

    const real = {
      ...CREATED,
      id: 'real-server-id',
      path: 'src/b.ts',
      startLine: 4,
      body: 'look here',
    }
    setAuthoritative([real, existing])
    write.resolve({ ok: true, value: real })
    refetch.resolve()
    await adding
    await waitFor(() =>
      expect(result.current.list.map((c) => c.id)).toEqual(['real-server-id', existing.id]),
    )
  })

  it('reconciles the temporary id with the authoritative add result before refetch settles', async () => {
    const existing = { ...FIXTURE }
    const { write, refetch, setAuthoritative, mount } = comments([existing])
    const result = await mount()

    let adding!: Promise<void>
    act(() => {
      adding = result.current.add({ path: 'src/b.ts', body: 'look here' })
    })
    await waitFor(() => expect(result.current.list[0]?.id).toMatch(/^optimistic-/))
    const tempId = result.current.list[0]?.id

    const real = { ...CREATED, id: 'authoritative-id', path: 'src/b.ts', body: 'look here' }
    write.resolve({ ok: true, value: real })
    await waitFor(() => {
      expect(result.current.list.map((c) => c.id)).toContain('authoritative-id')
      expect(result.current.list.map((c) => c.id)).not.toContain(tempId)
    })

    setAuthoritative([real, existing])
    refetch.resolve()
    await adding
  })

  it('drops the optimistic comment when the add fails', async () => {
    const existing = { ...FIXTURE }
    const { write, refetch, mount } = comments([existing])
    const result = await mount()

    let adding!: Promise<void>
    act(() => {
      adding = result.current.add({ path: 'src/b.ts', body: 'look here' })
    })
    await waitFor(() => expect(result.current.list).toHaveLength(2))

    write.resolve({ ok: false, error: { ...UNAVAILABLE, message: 'disk full' } })
    await waitFor(() => expect(result.current.list).toEqual([existing]))

    refetch.resolve()
    await expect(adding).rejects.toThrow()
  })

  it('removes a comment and puts it back when the delete fails', async () => {
    const existing = { ...FIXTURE, id: 'c1', createdAt: 1 }
    const other = { ...FIXTURE, id: 'c2', createdAt: 5, body: 'other' }
    const { write, refetch, mount } = comments([other, existing])
    const result = await mount()

    let removing!: Promise<void>
    act(() => {
      removing = result.current.remove('c2')
    })
    await waitFor(() => expect(result.current.list).toEqual([existing]))

    write.resolve({ ok: false, error: { ...UNAVAILABLE, message: 'locked' } })
    await waitFor(() => expect(result.current.list).toEqual([other, existing]))

    refetch.resolve()
    await expect(removing).rejects.toThrow()
  })

  it('edits the body only in the cache before the server answers', async () => {
    const open = { ...FIXTURE, body: 'original' }
    const { write, refetch, setAuthoritative, mount } = comments([open])
    const result = await mount()

    let editing!: Promise<void>
    act(() => {
      editing = result.current.edit(open.id, 'edited body')
    })
    await waitFor(() => expect(result.current.list[0]?.body).toBe('edited body'))

    setAuthoritative([{ ...open, body: 'edited body' }])
    write.resolve({ ok: true, value: undefined })
    refetch.resolve()
    await editing
    await waitFor(() => expect(result.current.list[0]?.body).toBe('edited body'))
  })

  it('clears closed comments and restores them when the write fails', async () => {
    const open = { ...FIXTURE, id: 'c1', resolved: false, createdAt: 1 }
    const closed = { ...FIXTURE, id: 'c2', resolved: true, createdAt: 5 }
    const { write, refetch, mount } = comments([closed, open])
    const result = await mount()

    let clearing!: Promise<void>
    act(() => {
      clearing = result.current.clearResolved()
    })
    await waitFor(() => expect(result.current.list).toEqual([open]))

    write.resolve({ ok: false, error: { ...UNAVAILABLE, message: 'locked' } })
    await waitFor(() => expect(result.current.list).toEqual([closed, open]))

    refetch.resolve()
    await expect(clearing).rejects.toThrow()
  })

  it('does not seed optimism when the comments list has never loaded', async () => {
    const write = deferred<
      { ok: true; value: typeof CREATED } | { ok: false; error: typeof UNAVAILABLE }
    >()
    let fetches = 0
    const { client, wrapper } = createCommentHarness({
      reviewComments: async () => {
        fetches += 1
        if (fetches === 1) await new Promise(() => undefined)
        return { ok: true, value: [] }
      },
      addReviewComment: async () => (await write.promise) as { ok: true; value: typeof CREATED },
    })
    ctx.client = client

    const hook = renderHook(
      () => ({
        list: useReviewComments(true),
        ...useCommentActions(),
      }),
      { wrapper },
    )
    expect(hook.result.current.list).toEqual([])

    let adding!: Promise<void>
    act(() => {
      adding = hook.result.current.add({ path: 'src/b.ts', body: 'look here' })
    })
    expect(hook.result.current.list).toEqual([])

    write.resolve({ ok: true, value: CREATED })
    await adding
    expect(hook.result.current.list).toEqual([])
  })

  it('invalidates the exact comments Query key after settle', async () => {
    const open = { ...FIXTURE, resolved: false }
    const { write, refetch, setAuthoritative, mount, mock } = comments([open])
    const result = await mount()
    mock.clearRequests()

    let resolving!: Promise<void>
    act(() => {
      resolving = result.current.setResolved(open.id, true)
    })
    await waitFor(() => expect(result.current.list[0]?.resolved).toBe(true))

    setAuthoritative([{ ...open, resolved: true }])
    write.resolve({ ok: true, value: undefined })
    refetch.resolve()
    await resolving

    await waitFor(() => {
      const lists = mock.requests().filter((r) => r.procedure === 'reviewComments')
      expect(lists.length).toBeGreaterThanOrEqual(1)
      expect(lists.every((r) => r.input === REPO)).toBe(true)
    })
  })
})
