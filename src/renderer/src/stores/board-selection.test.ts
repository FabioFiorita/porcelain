import type { BoardCard } from '@backend/board-store'
import { beforeEach, describe, expect, it } from 'vitest'
import { resolveBoardFocus, useBoardSelectionStore } from './board-selection'

const card = (id: string, status: BoardCard['status'], order: number, title = id): BoardCard => ({
  id,
  title,
  status,
  order,
  createdAt: order,
})

const repo = '/repo'

describe('resolveBoardFocus', () => {
  it('returns null on an empty board', () => {
    expect(resolveBoardFocus([], repo, null)).toBeNull()
    expect(resolveBoardFocus([], repo, { repoPath: repo, cardId: 'missing' })).toBeNull()
  })

  it('prefers an explicit selection that still exists on this repo', () => {
    const cards = [card('a', 'doing', 1), card('b', 'todo', 2), card('c', 'done', 3)]
    expect(resolveBoardFocus(cards, repo, { repoPath: repo, cardId: 'b' })?.id).toBe('b')
    expect(resolveBoardFocus(cards, repo, { repoPath: repo, cardId: 'c' })?.id).toBe('c')
  })

  it('ignores a selection from another repo', () => {
    const cards = [card('a', 'doing', 1), card('b', 'todo', 2)]
    expect(resolveBoardFocus(cards, repo, { repoPath: '/other', cardId: 'b' })?.id).toBe('a')
  })

  it('falls back when the selection is missing or stale', () => {
    const cards = [card('a', 'doing', 1), card('b', 'todo', 2)]
    expect(resolveBoardFocus(cards, repo, null)?.id).toBe('a')
    expect(resolveBoardFocus(cards, repo, { repoPath: repo, cardId: 'gone' })?.id).toBe('a')
  })

  it('defaults to first Doing, then Todo, then Done', () => {
    expect(resolveBoardFocus([card('t', 'todo', 1), card('d', 'done', 2)], repo, null)?.id).toBe(
      't',
    )
    expect(resolveBoardFocus([card('d', 'done', 1)], repo, null)?.id).toBe('d')
    expect(
      resolveBoardFocus(
        [card('t1', 'todo', 1), card('doing-late', 'doing', 3), card('doing-first', 'doing', 2)],
        repo,
        null,
      )?.id,
    ).toBe('doing-first')
  })
})

describe('useBoardSelectionStore', () => {
  beforeEach(() => {
    useBoardSelectionStore.setState({ focus: null })
  })

  it('selects and clears a focused card', () => {
    useBoardSelectionStore.getState().select('/repo', 'card-1')
    expect(useBoardSelectionStore.getState().focus).toEqual({
      repoPath: '/repo',
      cardId: 'card-1',
    })
    useBoardSelectionStore.getState().clear()
    expect(useBoardSelectionStore.getState().focus).toBeNull()
  })
})
