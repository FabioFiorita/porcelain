import { describe, expect, it } from 'vitest'
import { BOARD_STATUSES, boardCardSchema, boardContractFixtures } from './board.contract'
import { boardProcedures } from './board.procedures'

const expectedKinds = {
  boardCards: 'query',
  addBoardCard: 'mutation',
  updateBoardCard: 'mutation',
  moveBoardCard: 'mutation',
  deleteBoardCard: 'mutation',
  clearBoardCards: 'mutation',
} as const

const invalidInputs = {
  boardCards: 42,
  addBoardCard: { repoPath: '/synthetic/repo', title: '' },
  updateBoardCard: { repoPath: '/synthetic/repo', id: 'card-todo', title: '' },
  moveBoardCard: { repoPath: '/synthetic/repo', id: 'card-todo', status: 'blocked' },
  deleteBoardCard: { repoPath: '/synthetic/repo' },
  clearBoardCards: { repoPath: '/synthetic/repo', status: 'blocked' },
} as const

const invalidOutputs = {
  boardCards: [{ ...boardContractFixtures.boardCards.output[0], createdAt: '10' }],
  addBoardCard: { ...boardContractFixtures.addBoardCard.output, status: 'blocked' },
  updateBoardCard: null,
  moveBoardCard: null,
  deleteBoardCard: null,
  clearBoardCards: null,
} as const

describe('Board procedure contracts', () => {
  it('declares exactly six procedures with their router kinds', () => {
    expect(Object.keys(boardProcedures).sort()).toEqual(Object.keys(expectedKinds).sort())
    for (const [name, kind] of Object.entries(expectedKinds)) {
      expect(boardProcedures[name as keyof typeof boardProcedures].kind).toBe(kind)
    }
  })

  for (const name of Object.keys(boardProcedures) as Array<keyof typeof boardProcedures>) {
    it(`accepts valid ${name} input and output fixtures`, () => {
      const fixture = boardContractFixtures[name]
      const procedure = boardProcedures[name]
      expect(procedure.input.safeParse(fixture.input).success).toBe(true)
      expect(procedure.output.safeParse(fixture.output).success).toBe(true)
    })

    it(`rejects invalid ${name} input and output fixtures`, () => {
      const procedure = boardProcedures[name]
      expect(procedure.input.safeParse(invalidInputs[name]).success).toBe(false)
      expect(procedure.output.safeParse(invalidOutputs[name]).success).toBe(false)
    })
  }

  it('preserves every status, optional body, and server-side defaults', () => {
    const cards = BOARD_STATUSES.map((status, index) => ({
      id: `card-${status}`,
      title: `Card ${status}`,
      ...(status === 'doing' ? { body: 'present body' } : {}),
      status,
      order: index + 1,
      createdAt: index + 1,
    }))
    const parsedCards = boardProcedures.boardCards.output.parse(cards)
    expect(parsedCards).toEqual(cards)
    expect('body' in parsedCards[0]).toBe(false)
    expect(parsedCards[1]?.body).toBe('present body')

    for (const status of BOARD_STATUSES) {
      expect(
        boardProcedures.addBoardCard.input.safeParse({
          repoPath: '/synthetic/repo',
          title: 'A card',
          status,
        }).success,
      ).toBe(true)
      expect(
        boardProcedures.moveBoardCard.input.safeParse({
          repoPath: '/synthetic/repo',
          id: 'card-todo',
          status,
        }).success,
      ).toBe(true)
      expect(
        boardProcedures.clearBoardCards.input.safeParse({
          repoPath: '/synthetic/repo',
          status,
        }).success,
      ).toBe(true)
    }

    expect(
      boardProcedures.addBoardCard.input.parse({
        repoPath: '/synthetic/repo',
        title: 'Default card',
      }),
    ).toEqual({ repoPath: '/synthetic/repo', title: 'Default card' })
    expect(
      boardProcedures.addBoardCard.input.parse({
        repoPath: '/synthetic/repo',
        title: 'Empty body',
        body: '',
      }),
    ).toEqual({ repoPath: '/synthetic/repo', title: 'Empty body', body: '' })
    expect(
      boardProcedures.updateBoardCard.input.parse({
        repoPath: '/synthetic/repo',
        id: 'card-todo',
      }),
    ).toEqual({ repoPath: '/synthetic/repo', id: 'card-todo' })
    expect(boardProcedures.boardCards.output.safeParse([{}]).success).toBe(false)
  })

  it('preserves the current unbounded path, id, title, body, order, and time shapes', () => {
    expect(boardProcedures.boardCards.input.safeParse('').success).toBe(true)
    expect(
      boardProcedures.addBoardCard.input.safeParse({ repoPath: '', title: 'x', body: '' }).success,
    ).toBe(true)
    expect(
      boardProcedures.updateBoardCard.input.safeParse({ repoPath: '', id: '', body: '' }).success,
    ).toBe(true)
    expect(
      boardCardSchema.safeParse({
        id: '',
        title: '',
        status: 'todo',
        order: -1.5,
        createdAt: 0.5,
      }).success,
    ).toBe(true)
  })

  it('rejects unknown fields at strict input and nested card boundaries', () => {
    expect(
      boardProcedures.addBoardCard.input.safeParse({
        ...boardContractFixtures.addBoardCard.input,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      boardProcedures.updateBoardCard.input.safeParse({
        ...boardContractFixtures.updateBoardCard.input,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      boardProcedures.boardCards.output.safeParse([
        { ...boardContractFixtures.boardCards.output[0], extra: true },
      ]).success,
    ).toBe(false)
    expect(
      boardProcedures.addBoardCard.output.safeParse({
        ...boardContractFixtures.addBoardCard.output,
        extra: true,
      }).success,
    ).toBe(false)
  })

  it('keeps void mutation results distinct from card results', () => {
    expect(boardProcedures.addBoardCard.output.safeParse(undefined).success).toBe(false)
    for (const name of [
      'updateBoardCard',
      'moveBoardCard',
      'deleteBoardCard',
      'clearBoardCards',
    ] as const) {
      expect(boardProcedures[name].output.safeParse(undefined).success).toBe(true)
      expect(boardProcedures[name].output.safeParse(null).success).toBe(false)
    }
  })
})
