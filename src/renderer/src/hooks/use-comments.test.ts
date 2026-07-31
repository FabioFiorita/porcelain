import type { ReviewComment } from '@backend/comment-store'
import { useRepoStore } from '@renderer/stores/repo'
import { renderHook, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deferred, trpcWrapper } from './trpc-test-harness'
import { buildCommentIndex, useCommentActions, useReviewComments } from './use-comments'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

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

const REPO = '/repo'

type CommentsHookResult = { list: ReviewComment[] } & ReturnType<typeof useCommentActions>

/**
 * The list loads once; the reconciling refetch `onSettled` fires stays pending until the
 * test releases it, so nothing but the rollback can put a pre-mutation value back in the
 * cache. `write` answers the mutation itself.
 */
function comments(served: ReviewComment[]): {
  inputs: unknown[]
  write: ReturnType<typeof deferred<unknown>>
  refetch: ReturnType<typeof deferred<ReviewComment[]>>
  mounted: () => Promise<{ current: CommentsHookResult }>
} {
  const write = deferred<unknown>()
  const refetch = deferred<ReviewComment[]>()
  const inputs: unknown[] = []
  let fetches = 0
  const wrapper = trpcWrapper(async (op) => {
    if (op.path === 'reviewComments') {
      fetches += 1
      return fetches === 1 ? served : refetch.promise
    }
    inputs.push(op.input)
    return write.promise
  })
  const mounted = async (): Promise<{ current: CommentsHookResult }> => {
    const hook = renderHook(() => ({ list: useReviewComments(), ...useCommentActions() }), {
      wrapper,
    })
    await waitFor(() => expect(hook.result.current.list).toEqual(served))
    return hook.result
  }
  return { inputs, write, refetch, mounted }
}

describe('useCommentActions optimism', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockReset()
    useRepoStore.setState({ repo: { path: REPO, name: 'repo' } })
  })

  it('closes a comment in the cache before the server answers, then reconciles', async () => {
    const open = comment({ id: 'c1' })
    const { write, refetch, mounted } = comments([open])
    const result = await mounted()

    const resolving = result.current.setResolved('c1', true)
    await waitFor(() => expect(result.current.list[0]?.resolved).toBe(true))

    write.resolve(undefined)
    refetch.resolve([{ ...open, resolved: true }])
    await resolving
    await waitFor(() => expect(result.current.list).toEqual([{ ...open, resolved: true }]))
  })

  it('reopens the comment and toasts when the resolve fails', async () => {
    const open = comment({ id: 'c1' })
    const { write, refetch, mounted } = comments([open])
    const result = await mounted()

    const resolving = result.current.setResolved('c1', true)
    await waitFor(() => expect(result.current.list[0]?.resolved).toBe(true))

    write.reject(new Error('daemon down'))
    await waitFor(() => expect(result.current.list).toEqual([open]))

    refetch.resolve([open])
    await expect(resolving).rejects.toThrow('daemon down')
    expect(toast.error).toHaveBeenCalledWith('Resolve comment failed', {
      description: 'daemon down',
    })
  })

  it('prepends an added comment under a temporary id, never sending it to the daemon', async () => {
    const existing = comment({ id: 'c1' })
    const { inputs, write, refetch, mounted } = comments([existing])
    const result = await mounted()

    const adding = result.current.add({ path: 'src/b.ts', startLine: 4, body: 'look here' })
    await waitFor(() => expect(result.current.list).toHaveLength(2))
    expect(result.current.list[0]?.body).toBe('look here')
    expect(result.current.list[0]?.startLine).toBe(4)
    expect(result.current.list[0]?.id).toMatch(/^optimistic-/)
    expect(inputs).toEqual([{ repoPath: REPO, path: 'src/b.ts', startLine: 4, body: 'look here' }])

    const real = comment({ id: 'real', path: 'src/b.ts', startLine: 4, body: 'look here' })
    write.resolve(real)
    refetch.resolve([real, existing])
    await adding
    await waitFor(() => expect(result.current.list.map((c) => c.id)).toEqual(['real', 'c1']))
  })

  it('drops the optimistic comment when the add fails', async () => {
    const existing = comment({ id: 'c1' })
    const { write, refetch, mounted } = comments([existing])
    const result = await mounted()

    const adding = result.current.add({ path: 'src/b.ts', body: 'look here' })
    await waitFor(() => expect(result.current.list).toHaveLength(2))

    write.reject(new Error('disk full'))
    await waitFor(() => expect(result.current.list).toEqual([existing]))

    refetch.resolve([existing])
    await expect(adding).rejects.toThrow('disk full')
    expect(toast.error).toHaveBeenCalledWith('Add comment failed', { description: 'disk full' })
  })

  it('removes a comment and puts it back when the delete fails', async () => {
    const existing = comment({ id: 'c1' })
    const other = comment({ id: 'c2', createdAt: 5 })
    const { write, refetch, mounted } = comments([other, existing])
    const result = await mounted()

    const removing = result.current.remove('c2')
    await waitFor(() => expect(result.current.list).toEqual([existing]))

    write.reject(new Error('locked'))
    await waitFor(() => expect(result.current.list).toEqual([other, existing]))

    refetch.resolve([other, existing])
    await expect(removing).rejects.toThrow('locked')
  })

  it('clears closed comments and restores them when the write fails', async () => {
    const open = comment({ id: 'c1' })
    const closed = comment({ id: 'c2', resolved: true, createdAt: 5 })
    const { write, refetch, mounted } = comments([closed, open])
    const result = await mounted()

    const clearing = result.current.clearResolved()
    await waitFor(() => expect(result.current.list).toEqual([open]))

    write.reject(new Error('locked'))
    await waitFor(() => expect(result.current.list).toEqual([closed, open]))

    refetch.resolve([closed, open])
    await expect(clearing).rejects.toThrow('locked')
  })
})
