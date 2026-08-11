import { describe, expect, it } from 'vitest'
import {
  BOARD_FILE_VERSION,
  BoardFileParseError,
  emptyBoardFileV1,
  normalizeBoardTitle,
  parseBoardFileV1,
  planClearBoardColumn,
  planCreateBoardCard,
  planDeleteBoardCard,
  planMoveBoardCard,
  planUpdateBoardCard,
  serializeBoardFileV1,
  sortBoardCards,
} from './board-file'

const ID_A = '00000000-0000-4000-8000-0000000000a1'
const ID_B = '00000000-0000-4000-8000-0000000000b2'
const ID_C = '00000000-0000-4000-8000-0000000000c3'

function card(
  overrides: Partial<{
    id: string
    title: string
    body: string
    status: 'todo' | 'doing' | 'done'
    order: number
    createdAt: number
  }> = {},
) {
  return {
    id: overrides.id ?? ID_A,
    title: overrides.title ?? 'A card',
    status: overrides.status ?? ('todo' as const),
    order: overrides.order ?? 10,
    createdAt: overrides.createdAt ?? 10,
    ...(overrides.body !== undefined ? { body: overrides.body } : {}),
  }
}

describe('parseBoardFileV1 / serializeBoardFileV1', () => {
  it('accepts empty v1 and round-trips', () => {
    const empty = emptyBoardFileV1()
    expect(empty).toEqual({ version: 1, cards: [] })
    expect(parseBoardFileV1(empty)).toEqual(empty)
    expect(serializeBoardFileV1(empty)).toBe(`${JSON.stringify(empty, null, 2)}\n`)
  })

  it('accepts a complete card set and rejects unknown fields', () => {
    const file = {
      version: BOARD_FILE_VERSION,
      cards: [card({ body: 'notes' }), card({ id: ID_B, status: 'doing', order: 20 })],
    }
    expect(parseBoardFileV1(file).cards).toHaveLength(2)
    expect(() => parseBoardFileV1({ ...file, extra: true })).toThrow(BoardFileParseError)
    expect(() =>
      parseBoardFileV1({
        version: 1,
        cards: [{ ...card(), extra: true }],
      }),
    ).toThrow(/unknown field/)
  })

  it('rejects incompatible version, top-level arrays, and malformed shapes', () => {
    expect(() => parseBoardFileV1([])).toThrow(/JSON object/)
    expect(() => parseBoardFileV1({ version: 2, cards: [] })).toThrow(
      /unsupported Board file version/,
    )
    expect(() => parseBoardFileV1({ version: 1 })).toThrow(/cards must be an array/)
    expect(() => parseBoardFileV1({ cards: [] })).toThrow(/version is required/)
  })

  it('rejects duplicate IDs, non-UUID ids, invalid status, and bad numbers', () => {
    expect(() =>
      parseBoardFileV1({
        version: 1,
        cards: [card(), card({ id: ID_A, title: 'dup' })],
      }),
    ).toThrow(/duplicate/)
    expect(() => parseBoardFileV1({ version: 1, cards: [card({ id: 'not-a-uuid' })] })).toThrow(
      /UUID/,
    )
    expect(() =>
      parseBoardFileV1({
        version: 1,
        cards: [{ ...card(), status: 'blocked' }],
      }),
    ).toThrow(/status/)
    expect(() =>
      parseBoardFileV1({
        version: 1,
        cards: [{ ...card(), order: -1 }],
      }),
    ).toThrow(/order/)
    expect(() =>
      parseBoardFileV1({
        version: 1,
        cards: [{ ...card(), createdAt: 1.5 }],
      }),
    ).toThrow(/createdAt/)
    expect(() =>
      parseBoardFileV1({
        version: 1,
        cards: [{ ...card(), title: '   ' }],
      }),
    ).toThrow(/title/)
  })
})

describe('sortBoardCards', () => {
  it('orders by order, then createdAt, then id', () => {
    const sorted = sortBoardCards([
      card({ id: ID_C, order: 1, createdAt: 2 }),
      card({ id: ID_A, order: 1, createdAt: 1 }),
      card({ id: ID_B, order: 0, createdAt: 9 }),
    ])
    expect(sorted.map((c) => c.id)).toEqual([ID_B, ID_A, ID_C])
  })
})

describe('pure card transitions', () => {
  it('normalizes titles and rejects blank or too-long', () => {
    expect(normalizeBoardTitle('  ok  ')).toEqual({ ok: true, title: 'ok' })
    expect(normalizeBoardTitle('   ').ok).toBe(false)
    expect(normalizeBoardTitle('x'.repeat(241)).ok).toBe(false)
  })

  it('creates, updates, moves, deletes, and clears without mutating the input file', () => {
    const base = emptyBoardFileV1()
    const created = planCreateBoardCard(base, {
      id: ID_A,
      title: '  Ship  ',
      status: 'todo',
      order: 5,
      createdAt: 5,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(base.cards).toEqual([])
    expect(created.card.title).toBe('Ship')
    expect(created.card.status).toBe('todo')

    const updated = planUpdateBoardCard(created.file, {
      cardId: ID_A,
      title: 'Ship it',
      body: 'detail',
    })
    expect(updated.ok).toBe(true)
    if (!updated.ok) return
    expect(updated.card).toMatchObject({ title: 'Ship it', body: 'detail' })

    const moved = planMoveBoardCard(updated.file, { cardId: ID_A, status: 'done', order: 9 })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    expect(moved.card).toMatchObject({ status: 'done', order: 9 })

    const cleared = planClearBoardColumn(moved.file, { status: 'done' })
    expect(cleared.cardIds).toEqual([ID_A])
    expect(cleared.file.cards).toEqual([])

    const withTwo = planCreateBoardCard(emptyBoardFileV1(), {
      id: ID_B,
      title: 'Keep',
      order: 1,
      createdAt: 1,
    })
    if (!withTwo.ok) return
    const deleted = planDeleteBoardCard(withTwo.file, { cardId: ID_B })
    expect(deleted.ok).toBe(true)
    if (!deleted.ok) return
    expect(deleted.cardId).toBe(ID_B)
    expect(deleted.file.cards).toEqual([])
  })

  it('returns card-not-found for missing update/move/delete and empty clear cardIds', () => {
    const empty = emptyBoardFileV1()
    expect(planUpdateBoardCard(empty, { cardId: ID_A, title: 'x' })).toEqual({
      ok: false,
      error: { code: 'board.card-not-found', cardId: ID_A },
    })
    expect(planMoveBoardCard(empty, { cardId: ID_A, status: 'done', order: 1 })).toEqual({
      ok: false,
      error: { code: 'board.card-not-found', cardId: ID_A },
    })
    expect(planDeleteBoardCard(empty, { cardId: ID_A })).toEqual({
      ok: false,
      error: { code: 'board.card-not-found', cardId: ID_A },
    })
    expect(planClearBoardColumn(empty, { status: 'todo' }).cardIds).toEqual([])
  })
})
