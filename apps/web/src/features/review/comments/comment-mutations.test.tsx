import { publicErrorFixtures } from '@porcelain/contracts'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { reviewContractFixtures } from '@porcelain/contracts/review'
import { createValidatingTrpcHarness, deferred } from '@renderer/hooks/trpc-test-harness'
import { useRepoStore } from '@renderer/stores/repo'
import { act, renderHook, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCommentActions } from './comment-mutations'
import { useReviewComments } from './comment-queries'
import { reviewCommentsKeyForProject } from './comment-query-key'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const REPO = reviewContractFixtures.reviewComments.input
const FIXTURE = reviewContractFixtures.reviewComments.output[0]
if (FIXTURE === undefined) throw new Error('Expected reviewComments fixture')
const CREATED = reviewContractFixtures.addReviewComment.output

const UNAVAILABLE = publicErrorFixtures['review.unavailable']

type Combined = { list: ReturnType<typeof useReviewComments> } & ReturnType<
  typeof useCommentActions
>

/**
 * Comments load freely until `holdRefetch` is set; then reviewComments waits on
 * `refetch` so only the optimistic rollback can restore pre-mutation cache values
 * before the authoritative settle.
 */
function comments(served: readonly (typeof FIXTURE)[]) {
  const write = deferred<{ ok: true; value: unknown } | { ok: false; error: typeof UNAVAILABLE }>()
  const refetch = deferred<void>()
  const inputs: unknown[] = []
  let list = served.map((c) => ({ ...c }))
  let holdRefetch = false

  const { wrapper, mock } = createValidatingTrpcHarness({
    daemonInfo: () => ({ ok: true, value: remoteContractFixtures.daemonInfo.output }),
    reviewComments: async () => {
      if (holdRefetch) await refetch.promise
      return { ok: true, value: list.map((c) => ({ ...c })) }
    },
    addReviewComment: async (input) => {
      inputs.push(input)
      return (await write.promise) as
        | { ok: true; value: typeof CREATED }
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

  const mount = async (): Promise<{ current: Combined }> => {
    const hook = renderHook(
      () => ({
        list: useReviewComments(),
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
    write,
    refetch,
    mock,
    setAuthoritative: (next: readonly (typeof FIXTURE)[]) => {
      list = next.map((c) => ({ ...c }))
    },
    mount,
  }
}

beforeEach(() => {
  vi.mocked(toast.error).mockReset()
  useRepoStore.setState({ repo: { path: REPO, name: 'repo' } })
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

  it('restores the previous list and toasts when resolve fails with review.unavailable', async () => {
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
    expect(toast.error).toHaveBeenCalledWith('Resolve comment failed', {
      description: 'daemon down',
    })
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
    // Before releasing refetch, temporary id is already replaced.
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
    expect(toast.error).toHaveBeenCalledWith('Add comment failed', { description: 'disk full' })
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
    expect(toast.error).toHaveBeenCalledWith('Delete comment failed', { description: 'locked' })
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
    expect(toast.error).toHaveBeenCalledWith('Clear closed comments failed', {
      description: 'locked',
    })
  })

  it('does not seed optimism when the comments list has never loaded', async () => {
    const write = deferred<
      { ok: true; value: typeof CREATED } | { ok: false; error: typeof UNAVAILABLE }
    >()
    let fetches = 0
    const { wrapper } = createValidatingTrpcHarness({
      daemonInfo: () => ({ ok: true, value: remoteContractFixtures.daemonInfo.output }),
      // First list fetch never settles (never-loaded cache). Later fetches (post-settle
      // invalidate) return empty so the mutation can complete.
      reviewComments: async () => {
        fetches += 1
        if (fetches === 1) await new Promise(() => undefined)
        return { ok: true, value: [] }
      },
      addReviewComment: async () => (await write.promise) as { ok: true; value: typeof CREATED },
      editReviewComment: async () => ({ ok: true, value: undefined }),
      deleteReviewComment: async () => ({ ok: true, value: undefined }),
      resolveReviewComment: async () => ({ ok: true, value: undefined }),
      clearResolvedReviewComments: async () => ({ ok: true, value: undefined }),
    })

    const hook = renderHook(
      () => ({
        list: useReviewComments(),
        ...useCommentActions(),
      }),
      { wrapper },
    )
    // List never loads — data remains undefined, surface is still [].
    expect(hook.result.current.list).toEqual([])

    let adding!: Promise<void>
    act(() => {
      adding = hook.result.current.add({ path: 'src/b.ts', body: 'look here' })
    })
    // No optimistic seed — list stays empty while the write is in flight.
    expect(hook.result.current.list).toEqual([])

    write.resolve({ ok: true, value: CREATED })
    await adding
    expect(hook.result.current.list).toEqual([])
  })

  it('invalidates the exact comments Query key after settle', async () => {
    const open = { ...FIXTURE, resolved: false }
    const { write, refetch, setAuthoritative, mount, mock } = comments([open])
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

    // After settle, an additional reviewComments query for the Project must have been issued.
    const listRequests = mock.requests().filter((r) => r.procedure === 'reviewComments')
    expect(listRequests.length).toBeGreaterThanOrEqual(2)
    expect(listRequests.every((r) => r.input === REPO)).toBe(true)

    // Key shape stays typed identity + daemon scope (daemonInfo may still be null in tests).
    const key = reviewCommentsKeyForProject({ host: null, version: null }, REPO)
    expect(key[0]).toEqual({ domain: 'review', name: 'comments', projectPath: REPO })
  })
})
