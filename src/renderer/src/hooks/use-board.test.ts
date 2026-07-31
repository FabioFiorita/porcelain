import type { BoardCard } from '@backend/stores/board-store'
import { useRepoStore } from '@renderer/stores/repo'
import { renderHook, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deferred, trpcWrapper } from './trpc-test-harness'
import { useBoardCards, useCardActions } from './use-board'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const REPO = '/repo'

function card(overrides: Partial<BoardCard> = {}): BoardCard {
  return { id: 'c1', title: 'One', status: 'todo', order: 1, createdAt: 1, ...overrides }
}

type BoardHookResult = ReturnType<typeof useBoardCards> & ReturnType<typeof useCardActions>

/**
 * The board loads once; the reconciling refetch `onSettled` fires stays pending until the
 * test releases it, so nothing but the rollback can put a pre-mutation value back in the
 * cache. `write` answers the mutation itself.
 */
function board(served: BoardCard[]): {
  inputs: unknown[]
  write: ReturnType<typeof deferred<unknown>>
  refetch: ReturnType<typeof deferred<BoardCard[]>>
  mounted: () => Promise<{ current: BoardHookResult }>
} {
  const write = deferred<unknown>()
  const refetch = deferred<BoardCard[]>()
  const inputs: unknown[] = []
  let fetches = 0
  const wrapper = trpcWrapper(async (op) => {
    if (op.path === 'boardCards') {
      fetches += 1
      return fetches === 1 ? served : refetch.promise
    }
    inputs.push(op.input)
    return write.promise
  })
  const mounted = async (): Promise<{ current: BoardHookResult }> => {
    const hook = renderHook(() => ({ ...useBoardCards(), ...useCardActions() }), { wrapper })
    await waitFor(() => expect(hook.result.current.cards).toEqual(served))
    return hook.result
  }
  return { inputs, write, refetch, mounted }
}

beforeEach(() => {
  vi.mocked(toast.error).mockReset()
  useRepoStore.setState({ repo: { path: REPO, name: 'repo' } })
})

describe('useCardActions optimism', () => {
  it('moves the card in the cache before the server answers, then reconciles', async () => {
    const { write, refetch, mounted } = board([card()])
    const result = await mounted()

    const moving = result.current.move('c1', 'done')
    await waitFor(() => expect(result.current.cards[0]?.status).toBe('done'))

    write.resolve(undefined)
    refetch.resolve([card({ status: 'done', order: 9 })])
    await moving
    await waitFor(() => expect(result.current.cards).toEqual([card({ status: 'done', order: 9 })]))
  })

  it('restores the previous column and toasts when the move fails', async () => {
    const { write, refetch, mounted } = board([card()])
    const result = await mounted()

    const moving = result.current.move('c1', 'done')
    await waitFor(() => expect(result.current.cards[0]?.status).toBe('done'))

    write.reject(new Error('daemon down'))
    await waitFor(() => expect(result.current.cards).toEqual([card()]))

    refetch.resolve([card()])
    await expect(moving).rejects.toThrow('daemon down')
    expect(toast.error).toHaveBeenCalledWith('Move card failed', { description: 'daemon down' })
  })

  it('shows an added card under a temporary id that is never sent to the daemon', async () => {
    const { inputs, write, refetch, mounted } = board([card()])
    const result = await mounted()

    const adding = result.current.add({ title: 'Two', status: 'doing' })
    await waitFor(() => expect(result.current.cards).toHaveLength(2))
    expect(result.current.cards[1]?.title).toBe('Two')
    expect(result.current.cards[1]?.status).toBe('doing')
    expect(result.current.cards[1]?.id).toMatch(/^optimistic-/)
    expect(inputs).toEqual([{ repoPath: REPO, title: 'Two', status: 'doing' }])

    const real = card({ id: 'real', title: 'Two', status: 'doing', order: 2 })
    write.resolve(real)
    refetch.resolve([card(), real])
    await adding
    await waitFor(() => expect(result.current.cards.map((c) => c.id)).toEqual(['c1', 'real']))
  })

  it('drops the optimistic card when the add fails', async () => {
    const { write, refetch, mounted } = board([card()])
    const result = await mounted()

    const adding = result.current.add({ title: 'Two' })
    await waitFor(() => expect(result.current.cards).toHaveLength(2))

    write.reject(new Error('disk full'))
    await waitFor(() => expect(result.current.cards).toEqual([card()]))

    refetch.resolve([card()])
    await expect(adding).rejects.toThrow('disk full')
    expect(toast.error).toHaveBeenCalledWith('Add card failed', { description: 'disk full' })
  })

  it('empties a column on clear and puts it back when the write fails', async () => {
    const done = card({ id: 'c2', status: 'done', order: 2 })
    const { write, refetch, mounted } = board([card(), done])
    const result = await mounted()

    const clearing = result.current.clear('done')
    await waitFor(() => expect(result.current.cards).toEqual([card()]))

    write.reject(new Error('locked'))
    await waitFor(() => expect(result.current.cards).toEqual([card(), done]))

    refetch.resolve([card(), done])
    await expect(clearing).rejects.toThrow('locked')
  })

  it('renames a card in place and restores the old title when the edit fails', async () => {
    const { write, refetch, mounted } = board([card()])
    const result = await mounted()

    const updating = result.current.update('c1', { title: 'Renamed' })
    await waitFor(() => expect(result.current.cards[0]?.title).toBe('Renamed'))

    write.reject(new Error('read-only'))
    await waitFor(() => expect(result.current.cards).toEqual([card()]))

    refetch.resolve([card()])
    await expect(updating).rejects.toThrow('read-only')
  })
})
