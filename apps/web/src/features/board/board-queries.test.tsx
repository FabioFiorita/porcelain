import { boardCardFixture, boardContractFixtures } from '@porcelain/contracts/board'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { createValidatingTrpcHarness, deferred } from '@renderer/hooks/trpc-test-harness'
import { useRepoStore } from '@renderer/stores/repo'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useBoardCards } from './board-queries'
import { boardCardsKeyForProject } from './board-query-key'

const REPO = boardContractFixtures.listBoardCards.input
const OTHER = '/synthetic/other'

const baseHandlers = {
  daemonInfo: () => ({ ok: true as const, value: remoteContractFixtures.daemonInfo.output }),
}

describe('useBoardCards', () => {
  beforeEach(() => {
    useRepoStore.setState({ repo: { path: REPO, name: 'repo' } })
  })

  it('queries listBoardCards for the active Project and exposes contract-valid cards', async () => {
    const cards = boardContractFixtures.listBoardCards.output
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      listBoardCards: (input) => {
        expect(input).toBe(REPO)
        return { ok: true, value: cards }
      },
    })

    const { result } = renderHook(() => useBoardCards(), { wrapper })
    await waitFor(() => expect(result.current.isLoaded).toBe(true))

    expect(result.current.error).toBeNull()
    expect(result.current.cards).toEqual(cards)
    expect(mock.requests().filter((r) => r.procedure === 'listBoardCards')).toContainEqual({
      procedure: 'listBoardCards',
      kind: 'query',
      input: REPO,
    })
  })

  it('distinguishes unloaded, empty, and failed Board reads', async () => {
    useRepoStore.setState({ repo: null })
    const idle = createValidatingTrpcHarness({
      ...baseHandlers,
      listBoardCards: () => ({ ok: true, value: [] }),
    })
    const unloaded = renderHook(() => useBoardCards(), { wrapper: idle.wrapper })
    expect(unloaded.result.current).toEqual({ cards: [], error: null, isLoaded: false })

    useRepoStore.setState({ repo: { path: REPO, name: 'repo' } })
    const empty = createValidatingTrpcHarness({
      ...baseHandlers,
      listBoardCards: () => ({ ok: true, value: [] }),
    })
    const emptyHook = renderHook(() => useBoardCards(), { wrapper: empty.wrapper })
    await waitFor(() => expect(emptyHook.result.current.isLoaded).toBe(true))
    expect(emptyHook.result.current).toEqual({ cards: [], error: null, isLoaded: true })

    const failed = createValidatingTrpcHarness({
      ...baseHandlers,
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
    const failedHook = renderHook(() => useBoardCards(), { wrapper: failed.wrapper })
    await waitFor(() => expect(failedHook.result.current.isLoaded).toBe(true))
    expect(failedHook.result.current.cards).toEqual([])
    expect(failedHook.result.current.error).toBeTruthy()
    expect(failedHook.result.current.isLoaded).toBe(true)
  })

  it('embeds the BRD-003 cards identity and daemon scope in the React Query key', () => {
    const key = boardCardsKeyForProject({ host: 'beelink', version: '0.52.1' }, REPO)
    expect(key[0]).toEqual({ domain: 'board', name: 'cards', projectPath: REPO })
    expect(key[1]).toEqual({ host: 'beelink', version: '0.52.1' })
    expect(boardCardsKeyForProject({ host: 'beelink', version: '0.52.1' }, OTHER)[0]).not.toEqual(
      key[0],
    )
    expect(boardCardFixture({ title: 'x' }).title).toBe('x')
  })

  it('keeps a pending first load unloaded until settlement', async () => {
    const pending = deferred<typeof boardContractFixtures.listBoardCards.output>()
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      listBoardCards: () => pending.promise.then((value) => ({ ok: true as const, value })),
    })
    const { result } = renderHook(() => useBoardCards(), { wrapper })
    expect(result.current.isLoaded).toBe(false)
    expect(result.current.cards).toEqual([])
    pending.resolve([])
    await waitFor(() => expect(result.current.isLoaded).toBe(true))
  })
})
