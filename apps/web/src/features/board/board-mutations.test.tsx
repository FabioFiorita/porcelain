import { boardCardFixture, boardContractFixtures } from '@porcelain/contracts/board'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { createValidatingTrpcHarness, deferred } from '@renderer/hooks/trpc-test-harness'
import { useRepoStore } from '@renderer/stores/repo'
import { act, renderHook, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBoardCardActions } from './board-mutations'
import { useBoardCards } from './board-queries'
import { boardCardAt } from './test-support'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const REPO = boardContractFixtures.listBoardCards.input
const CARD = boardCardAt(0)
const CREATED = boardContractFixtures.createBoardCard.output

const UNAVAILABLE = {
  code: 'board.unavailable' as const,
  category: 'unavailable' as const,
  message: 'daemon down',
  retryable: true as const,
  requestId: '00000000-0000-4000-8000-000000000099',
}

type Combined = ReturnType<typeof useBoardCards> & ReturnType<typeof useBoardCardActions>

/**
 * Board loads freely until `holdRefetch` is set; then listBoardCards waits on
 * `refetch` so only the optimistic rollback can restore pre-mutation cache values
 * before the authoritative settle.
 */
function board(served: readonly (typeof CARD)[]) {
  const write = deferred<{ ok: true; value: unknown } | { ok: false; error: typeof UNAVAILABLE }>()
  const refetch = deferred<void>()
  const inputs: unknown[] = []
  let cards = served.map((c) => ({ ...c }))
  let holdRefetch = false

  const { wrapper } = createValidatingTrpcHarness({
    daemonInfo: () => ({ ok: true, value: remoteContractFixtures.daemonInfo.output }),
    listBoardCards: async () => {
      if (holdRefetch) await refetch.promise
      return { ok: true, value: cards.map((c) => ({ ...c })) }
    },
    createBoardCard: async (input) => {
      inputs.push(input)
      return (await write.promise) as
        | { ok: true; value: typeof CREATED }
        | { ok: false; error: typeof UNAVAILABLE }
    },
    updateBoardCard: async () =>
      (await write.promise) as
        | { ok: true; value: typeof CARD }
        | { ok: false; error: typeof UNAVAILABLE },
    moveBoardCard: async () =>
      (await write.promise) as
        | { ok: true; value: typeof CARD }
        | { ok: false; error: typeof UNAVAILABLE },
    deleteBoardCard: async () =>
      (await write.promise) as
        | { ok: true; value: { cardId: string } }
        | { ok: false; error: typeof UNAVAILABLE },
    clearBoardColumn: async () =>
      (await write.promise) as
        | { ok: true; value: { status: 'done'; cardIds: string[] } }
        | { ok: false; error: typeof UNAVAILABLE },
  })

  const mount = async (): Promise<{ current: Combined }> => {
    const hook = renderHook(
      () => ({
        ...useBoardCards(),
        ...useBoardCardActions(),
      }),
      { wrapper },
    )
    await waitFor(() => expect(hook.result.current.cards).toEqual(served.map((c) => ({ ...c }))))
    holdRefetch = true
    return hook.result
  }

  return {
    inputs,
    write,
    refetch,
    setAuthoritative: (next: readonly (typeof CARD)[]) => {
      cards = next.map((c) => ({ ...c }))
    },
    mount,
  }
}

beforeEach(() => {
  vi.mocked(toast.error).mockReset()
  useRepoStore.setState({ repo: { path: REPO, name: 'repo' } })
})

describe('useBoardCardActions optimism', () => {
  it('moves the card in the cache before the server answers, then reconciles', async () => {
    const { write, refetch, setAuthoritative, mount } = board([CARD])
    const result = await mount()

    let moving!: Promise<void>
    act(() => {
      moving = result.current.move(CARD.id, 'done')
    })
    await waitFor(() => expect(result.current.cards[0]?.status).toBe('done'))
    expect(result.current.isPending).toBe(true)

    setAuthoritative([{ ...CARD, status: 'done', order: 9 }])
    write.resolve({ ok: true, value: { ...CARD, status: 'done', order: 9 } })
    refetch.resolve()
    await moving
    await waitFor(() =>
      expect(result.current.cards).toEqual([{ ...CARD, status: 'done', order: 9 }]),
    )
  })

  it('restores the previous column and toasts when the move fails', async () => {
    const { write, refetch, mount } = board([CARD])
    const result = await mount()

    let moving!: Promise<void>
    act(() => {
      moving = result.current.move(CARD.id, 'done')
    })
    await waitFor(() => expect(result.current.cards[0]?.status).toBe('done'))

    write.resolve({ ok: false, error: { ...UNAVAILABLE, message: 'daemon down' } })
    await waitFor(() => expect(result.current.cards).toEqual([CARD]))

    refetch.resolve()
    await expect(moving).rejects.toThrow()
    expect(toast.error).toHaveBeenCalledWith('Move card failed', {
      description: 'daemon down',
    })
  })

  it('shows an added card under a temporary id that is never sent to the daemon', async () => {
    const { inputs, write, refetch, setAuthoritative, mount } = board([CARD])
    const result = await mount()

    let adding!: Promise<void>
    act(() => {
      adding = result.current.add({ title: 'Two', status: 'doing' })
    })
    await waitFor(() => expect(result.current.cards).toHaveLength(2))
    expect(result.current.cards[1]?.title).toBe('Two')
    expect(result.current.cards[1]?.status).toBe('doing')
    expect(result.current.cards[1]?.id).toMatch(/^optimistic-/)
    expect(inputs).toEqual([
      {
        projectPath: REPO,
        title: 'Two',
        status: 'doing',
      },
    ])

    setAuthoritative([CARD, CREATED])
    write.resolve({ ok: true, value: CREATED })
    refetch.resolve()
    await adding
    await waitFor(() =>
      expect(result.current.cards.map((c) => c.id)).toEqual([CARD.id, CREATED.id]),
    )
  })

  it('drops the optimistic card when the add fails', async () => {
    const { write, refetch, mount } = board([CARD])
    const result = await mount()

    let adding!: Promise<void>
    act(() => {
      adding = result.current.add({ title: 'Two' })
    })
    await waitFor(() => expect(result.current.cards).toHaveLength(2))

    write.resolve({ ok: false, error: { ...UNAVAILABLE, message: 'disk full' } })
    await waitFor(() => expect(result.current.cards).toEqual([CARD]))

    refetch.resolve()
    await expect(adding).rejects.toThrow()
    expect(toast.error).toHaveBeenCalledWith('Add card failed', { description: 'disk full' })
  })

  it('empties a column on clear and puts it back when the write fails', async () => {
    const done = boardCardFixture({
      id: '00000000-0000-4000-8000-000000000201',
      status: 'done',
      order: 2,
      title: 'Done card',
    })
    const { write, refetch, mount } = board([CARD, done])
    const result = await mount()

    let clearing!: Promise<void>
    act(() => {
      clearing = result.current.clear('done')
    })
    await waitFor(() => expect(result.current.cards).toEqual([CARD]))

    write.resolve({ ok: false, error: { ...UNAVAILABLE, message: 'locked' } })
    await waitFor(() => expect(result.current.cards).toEqual([CARD, done]))

    refetch.resolve()
    await expect(clearing).rejects.toThrow()
  })

  it('renames a card in place and restores the old title when the edit fails', async () => {
    const { write, refetch, mount } = board([CARD])
    const result = await mount()

    let updating!: Promise<void>
    act(() => {
      updating = result.current.update(CARD.id, { title: 'Renamed' })
    })
    await waitFor(() => expect(result.current.cards[0]?.title).toBe('Renamed'))

    write.resolve({ ok: false, error: { ...UNAVAILABLE, message: 'read-only' } })
    await waitFor(() => expect(result.current.cards).toEqual([CARD]))

    refetch.resolve()
    await expect(updating).rejects.toThrow()
  })

  it('deletes optimistically and rolls back on failure', async () => {
    const { write, refetch, mount } = board([CARD])
    const result = await mount()

    let removing!: Promise<void>
    act(() => {
      removing = result.current.remove(CARD.id)
    })
    await waitFor(() => expect(result.current.cards).toEqual([]))

    write.resolve({ ok: false, error: { ...UNAVAILABLE, message: 'locked' } })
    await waitFor(() => expect(result.current.cards).toEqual([CARD]))

    refetch.resolve()
    await expect(removing).rejects.toThrow()
  })
})
