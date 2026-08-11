import { type BoardCard, boardCardFixture, boardContractFixtures } from '@porcelain/contracts/board'
import { describe, expect, it } from 'vitest'
import { boardMutations } from './board-mutations'
import {
  applyBoardOptimisticTransition,
  reconcileBoardMutation,
  rollbackBoardOptimisticTransition,
} from './board-reconciliation'

const TEMP_ID = '00000000-0000-4000-8000-000000000099'
const NOW = 1_700_000_000_000
const OPTIMISTIC = { temporaryId: TEMP_ID, now: NOW } as const

const fixtures = boardContractFixtures
const baseCards: readonly BoardCard[] = fixtures.listBoardCards.output

describe('applyBoardOptimisticTransition', () => {
  it('appends a create card with adapter temporaryId and now', () => {
    const { cards, snapshot } = applyBoardOptimisticTransition(
      baseCards,
      'create',
      fixtures.createBoardCard.input,
      OPTIMISTIC,
    )

    expect(snapshot.cards).toEqual(baseCards)
    expect(cards).toHaveLength(baseCards.length + 1)
    expect(cards[cards.length - 1]).toEqual({
      id: TEMP_ID,
      title: fixtures.createBoardCard.input.title,
      body: fixtures.createBoardCard.input.body,
      status: fixtures.createBoardCard.input.status,
      order: NOW,
      createdAt: NOW,
    })
  })

  it('defaults create status to todo when omitted', () => {
    const { cards } = applyBoardOptimisticTransition(
      baseCards,
      'create',
      { projectPath: fixtures.createBoardCard.input.projectPath, title: 'Untitled' },
      OPTIMISTIC,
    )
    expect(cards[cards.length - 1]?.status).toBe('todo')
  })

  it('patches supplied title and body on update', () => {
    const { cards } = applyBoardOptimisticTransition(
      baseCards,
      'update',
      fixtures.updateBoardCard.input,
      OPTIMISTIC,
    )
    const updated = cards.find((card) => card.id === fixtures.updateBoardCard.input.cardId)
    expect(updated?.title).toBe(fixtures.updateBoardCard.input.title)
    expect(updated?.body).toBe(fixtures.updateBoardCard.input.body)
  })

  it('moves a card to a new status with order = now', () => {
    const { cards } = applyBoardOptimisticTransition(
      baseCards,
      'move',
      fixtures.moveBoardCard.input,
      OPTIMISTIC,
    )
    const moved = cards.find((card) => card.id === fixtures.moveBoardCard.input.cardId)
    expect(moved?.status).toBe(fixtures.moveBoardCard.input.status)
    expect(moved?.order).toBe(NOW)
    // Moved card is last so it sorts to the end of its new column.
    expect(cards[cards.length - 1]?.id).toBe(fixtures.moveBoardCard.input.cardId)
  })

  it('removes one card on delete', () => {
    const { cards } = applyBoardOptimisticTransition(
      baseCards,
      'delete',
      fixtures.deleteBoardCard.input,
      OPTIMISTIC,
    )
    expect(cards.some((card) => card.id === fixtures.deleteBoardCard.input.cardId)).toBe(false)
    expect(cards).toHaveLength(baseCards.length - 1)
  })

  it('removes only the selected status on clearColumn', () => {
    const { cards } = applyBoardOptimisticTransition(
      baseCards,
      'clearColumn',
      fixtures.clearBoardColumn.input,
      OPTIMISTIC,
    )
    expect(cards.every((card) => card.status !== fixtures.clearBoardColumn.input.status)).toBe(true)
    expect(cards).toEqual(baseCards.filter((card) => card.status !== 'todo'))
  })

  it('leaves the collection unchanged for an absent id', () => {
    const missing = '00000000-0000-4000-8000-0000000000ff'
    for (const mutation of ['update', 'move', 'delete'] as const) {
      const input =
        mutation === 'update'
          ? { projectPath: fixtures.updateBoardCard.input.projectPath, cardId: missing, title: 'X' }
          : mutation === 'move'
            ? {
                projectPath: fixtures.moveBoardCard.input.projectPath,
                cardId: missing,
                status: 'done' as const,
              }
            : { projectPath: fixtures.deleteBoardCard.input.projectPath, cardId: missing }

      const { cards, snapshot } = applyBoardOptimisticTransition(
        baseCards,
        mutation,
        input,
        OPTIMISTIC,
      )
      expect(cards).toEqual(baseCards)
      expect(snapshot.cards).toEqual(baseCards)
    }
  })
})

describe('rollbackBoardOptimisticTransition', () => {
  it('returns the exact pre-mutation cards', () => {
    const original = [boardCardFixture({ id: '00000000-0000-4000-8000-000000000201' })]
    const { snapshot } = applyBoardOptimisticTransition(
      original,
      'create',
      fixtures.createBoardCard.input,
      OPTIMISTIC,
    )
    expect(rollbackBoardOptimisticTransition(snapshot)).toEqual(original)
    expect(rollbackBoardOptimisticTransition(snapshot)).toBe(snapshot.cards)
  })
})

describe('reconcileBoardMutation', () => {
  it('replaces a temporary create card with the canonical create result', () => {
    const { cards: optimistic } = applyBoardOptimisticTransition(
      baseCards,
      'create',
      fixtures.createBoardCard.input,
      OPTIMISTIC,
    )
    const reconciled = reconcileBoardMutation(optimistic, 'create', {
      temporaryId: TEMP_ID,
      result: fixtures.createBoardCard.output,
    })
    expect(reconciled.some((card) => card.id === TEMP_ID)).toBe(false)
    expect(reconciled).toContainEqual(fixtures.createBoardCard.output)
    expect(reconciled).toHaveLength(optimistic.length)
  })

  it('returns the optimistic collection when create result is not supplied', () => {
    const { cards: optimistic } = applyBoardOptimisticTransition(
      baseCards,
      'create',
      fixtures.createBoardCard.input,
      OPTIMISTIC,
    )
    expect(reconcileBoardMutation(optimistic, 'create', { temporaryId: TEMP_ID })).toBe(optimistic)
    expect(reconcileBoardMutation(optimistic, 'create')).toBe(optimistic)
  })

  it('returns the optimistic collection for non-create mutations', () => {
    const { cards: optimistic } = applyBoardOptimisticTransition(
      baseCards,
      'move',
      fixtures.moveBoardCard.input,
      OPTIMISTIC,
    )
    expect(
      reconcileBoardMutation(optimistic, 'move', {
        result: fixtures.createBoardCard.output,
      }),
    ).toBe(optimistic)
  })

  it('declares authoritative refetch on every Board mutation definition', () => {
    for (const definition of Object.values(boardMutations)) {
      expect(definition.requiresAuthoritativeRefetch).toBe(true)
    }
  })
})
