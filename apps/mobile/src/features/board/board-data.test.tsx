import { boardCardFixture, boardContractFixtures } from '@porcelain/contracts/board'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { boardCardsQueryKey, useBoardCardActions, useBoardCards } from './board-data'
import {
  CARDS,
  createBoardHarness,
  deferred,
  ENV_ID,
  PAIRED_ENV,
  REPO,
  type TestDaemonClient,
  type TestPairedEnvironment,
} from './test-support'

const UNAVAILABLE = {
  code: 'board.unavailable' as const,
  category: 'unavailable' as const,
  message: 'daemon down',
  retryable: true as const,
  requestId: '00000000-0000-4000-8000-000000000099',
}

const CARD = boardContractFixtures.listBoardCards.output[0] as NonNullable<
  (typeof boardContractFixtures.listBoardCards.output)[0]
>
const CREATED = boardContractFixtures.createBoardCard.output

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

vi.mock('@/features/projects', () => ({
  useActiveProject: () => (ctx.repoPath === null ? null : { path: ctx.repoPath, name: 'repo' }),
}))

vi.mock('@/features/remote', () => ({
  // Pure identity the subject reads from the same feature index; the store half is faked below.
  isPaired: (environment: { token: string | null } | null): boolean =>
    environment !== null && environment.token !== null,
  useActiveEnvironment: () => ctx.env,
}))

vi.mock('@/features/shell/use-app-window', () => ({
  useIsTablet: () => true,
}))

vi.mock('@/features/shell/shell-store', () => ({
  useShellStore: (
    selector: (state: { openSheet: () => void; setActiveSurface: () => void }) => unknown,
  ) =>
    selector({
      openSheet: vi.fn(),
      setActiveSurface: vi.fn(),
    }),
}))

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

  const { mock, client, wrapper } = createBoardHarness({
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
  ctx.client = client

  const mount = async (): Promise<{ current: Combined }> => {
    const hook = renderHook(
      () => ({
        ...useBoardCards(true),
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
    mock,
    write,
    refetch,
    setAuthoritative: (next: readonly (typeof CARD)[]) => {
      cards = next.map((c) => ({ ...c }))
    },
    mount,
  }
}

beforeEach(() => {
  ctx.client = null
  ctx.env = { ...PAIRED_ENV }
  ctx.repoPath = REPO
})

describe('useBoardCards', () => {
  it('queries listBoardCards for the active Project/environment key', async () => {
    const cards = boardContractFixtures.listBoardCards.output
    const { mock, client, wrapper } = createBoardHarness({
      listBoardCards: (input) => {
        expect(input).toBe(REPO)
        return { ok: true, value: cards }
      },
    })
    ctx.client = client

    const { result } = renderHook(() => useBoardCards(true), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.error).toBeNull()
    expect(result.current.cards).toEqual(cards)
    expect(mock.requests().filter((r) => r.procedure === 'listBoardCards')).toContainEqual({
      procedure: 'listBoardCards',
      kind: 'query',
      input: REPO,
    })
    expect(boardCardsQueryKey(ENV_ID, REPO)).toEqual([
      'daemon',
      ENV_ID,
      { domain: 'board', name: 'cards', projectPath: REPO },
    ])
  })

  it('does not read when inactive or no Project', async () => {
    const { client, wrapper } = createBoardHarness({
      listBoardCards: () => ({ ok: true, value: CARDS }),
    })
    ctx.client = client

    const inactive = renderHook(() => useBoardCards(false), { wrapper })
    expect(inactive.result.current).toEqual({ cards: [], error: null, isLoading: false })

    ctx.repoPath = null
    const noRepo = renderHook(() => useBoardCards(true), { wrapper })
    expect(noRepo.result.current).toEqual({ cards: [], error: null, isLoading: false })
  })

  it('distinguishes loaded-empty from loading and failed Board reads', async () => {
    const empty = createBoardHarness({
      listBoardCards: () => ({ ok: true, value: [] }),
    })
    ctx.client = empty.client
    const emptyHook = renderHook(() => useBoardCards(true), { wrapper: empty.wrapper })
    await waitFor(() => expect(emptyHook.result.current.isLoading).toBe(false))
    expect(emptyHook.result.current).toEqual({ cards: [], error: null, isLoading: false })

    const failed = createBoardHarness({
      listBoardCards: () => ({
        ok: false,
        error: {
          code: 'board.unavailable',
          category: 'unavailable',
          message: 'The board is unavailable.',
          retryable: true,
          requestId: '00000000-0000-4000-8000-000000000099',
        },
      }),
    })
    ctx.client = failed.client
    const failedHook = renderHook(() => useBoardCards(true), { wrapper: failed.wrapper })
    await waitFor(() => expect(failedHook.result.current.error).not.toBeNull())
    expect(failedHook.result.current.cards).toEqual([])
    expect(failedHook.result.current.isLoading).toBe(false)
  })
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

    setAuthoritative([{ ...CARD, status: 'done', order: 9 }])
    write.resolve({ ok: true, value: { ...CARD, status: 'done', order: 9 } })
    refetch.resolve()
    await moving
    await waitFor(() =>
      expect(result.current.cards).toEqual([{ ...CARD, status: 'done', order: 9 }]),
    )
  })

  it('restores the previous column when the move fails', async () => {
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
      adding = result.current.add({ title: 'Two', status: 'todo' })
    })
    await waitFor(() => expect(result.current.cards).toHaveLength(2))

    write.resolve({ ok: false, error: { ...UNAVAILABLE, message: 'disk full' } })
    await waitFor(() => expect(result.current.cards).toEqual([CARD]))

    refetch.resolve()
    await expect(adding).rejects.toThrow()
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
      updating = result.current.update(CARD.id, { title: 'Renamed', body: CARD.body ?? '' })
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

  it('invalidates exactly the Project cards identity after settle', async () => {
    const { write, refetch, setAuthoritative, mount, mock } = board([CARD])
    const result = await mount()
    mock.clearRequests()

    let moving!: Promise<void>
    act(() => {
      moving = result.current.move(CARD.id, 'done')
    })
    await waitFor(() => expect(result.current.cards[0]?.status).toBe('done'))

    setAuthoritative([{ ...CARD, status: 'done', order: 9 }])
    write.resolve({ ok: true, value: { ...CARD, status: 'done', order: 9 } })
    refetch.resolve()
    await moving

    await waitFor(() => {
      const lists = mock.requests().filter((r) => r.procedure === 'listBoardCards')
      expect(lists.length).toBeGreaterThanOrEqual(1)
      expect(lists.every((r) => r.input === REPO)).toBe(true)
    })
  })
})
