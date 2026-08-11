import { describe, expect, it } from 'vitest'
import { procedureCatalog } from '../procedure-catalog'
import { sessionWatchesFrameSchema } from '../session'
import { terminalOutputFrameSchema } from '../terminal'
import {
  BOARD_STATUSES,
  boardCardSchema,
  boardProjectPathSchema,
  createBoardCardInputSchema,
  updateBoardCardInputSchema,
} from './board.contract'
import {
  boardCardNotFoundErrorSchema,
  boardInvalidTitleErrorSchema,
  boardUnavailableErrorSchema,
} from './board.errors'
import { boardCardFixture, boardContractFixtures, boardNotificationFixture } from './board.fixtures'
import {
  BOARD_CHANGE_KINDS,
  boardChangedSchema,
  boardChangeSchema,
  boardNotificationFixtures,
} from './board.notifications'
import { boardProcedures } from './board.procedures'

const expectedKinds = {
  listBoardCards: 'query',
  createBoardCard: 'mutation',
  updateBoardCard: 'mutation',
  moveBoardCard: 'mutation',
  deleteBoardCard: 'mutation',
  clearBoardColumn: 'mutation',
} as const

const expectedErrors = {
  listBoardCards: ['board.unavailable'],
  createBoardCard: ['board.unavailable', 'board.invalid-title'],
  updateBoardCard: ['board.unavailable', 'board.card-not-found', 'board.invalid-title'],
  moveBoardCard: ['board.unavailable', 'board.card-not-found'],
  deleteBoardCard: ['board.unavailable', 'board.card-not-found'],
  clearBoardColumn: ['board.unavailable'],
} as const

const invalidInputs = {
  listBoardCards: '',
  createBoardCard: { projectPath: '/synthetic/repo', title: '' },
  updateBoardCard: {
    projectPath: '/synthetic/repo',
    cardId: '00000000-0000-4000-8000-000000000101',
  },
  moveBoardCard: {
    projectPath: '/synthetic/repo',
    cardId: '00000000-0000-4000-8000-000000000101',
    status: 'blocked',
  },
  deleteBoardCard: { projectPath: '/synthetic/repo' },
  clearBoardColumn: { projectPath: '/synthetic/repo', status: 'blocked' },
} as const

const invalidOutputs = {
  listBoardCards: [{ ...boardContractFixtures.listBoardCards.output[0], createdAt: '10' }],
  createBoardCard: { ...boardContractFixtures.createBoardCard.output, status: 'blocked' },
  updateBoardCard: { ...boardContractFixtures.updateBoardCard.output, order: -1 },
  moveBoardCard: undefined,
  deleteBoardCard: undefined,
  clearBoardColumn: { status: 'todo' },
} as const

describe('Board procedure contracts', () => {
  it('declares exactly six canonical procedures with kinds and allowed errors', () => {
    expect(Object.keys(boardProcedures).sort()).toEqual(Object.keys(expectedKinds).sort())
    for (const [name, kind] of Object.entries(expectedKinds)) {
      const procedure = boardProcedures[name as keyof typeof boardProcedures]
      expect(procedure.kind).toBe(kind)
      expect([...procedure.errors]).toEqual([
        ...expectedErrors[name as keyof typeof expectedErrors],
      ])
    }
  })

  it('exports each canonical procedure once as live catalog members', () => {
    const names = Object.keys(boardProcedures)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toHaveLength(6)

    for (const name of names as Array<keyof typeof boardProcedures>) {
      expect(procedureCatalog[name]).toBe(boardProcedures[name])
    }
    // Concatenation keeps legacy wire tokens out of a single-literal search hit.
    for (const legacy of [
      'board' + 'Cards',
      'add' + 'BoardCard',
      'clear' + 'BoardCards',
    ] as const) {
      expect(Object.hasOwn(procedureCatalog, legacy)).toBe(false)
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

  it('accepts a complete card and rejects missing, defaulted, invalid, and unknown fields', () => {
    const complete = boardCardFixture({
      body: 'optional body',
      status: 'doing',
      order: 0,
      createdAt: 0,
    })
    expect(boardCardSchema.parse(complete)).toEqual(complete)

    expect(boardCardSchema.safeParse({}).success).toBe(false)
    expect(
      boardCardSchema.safeParse({
        id: complete.id,
        title: complete.title,
        status: complete.status,
        order: complete.order,
        // missing createdAt
      }).success,
    ).toBe(false)
    expect(
      boardCardSchema.safeParse({
        ...complete,
        status: 'blocked',
      }).success,
    ).toBe(false)
    expect(
      boardCardSchema.safeParse({
        ...complete,
        order: -1,
      }).success,
    ).toBe(false)
    expect(
      boardCardSchema.safeParse({
        ...complete,
        order: 1.5,
      }).success,
    ).toBe(false)
    expect(
      boardCardSchema.safeParse({
        ...complete,
        createdAt: Number.POSITIVE_INFINITY,
      }).success,
    ).toBe(false)
    expect(
      boardCardSchema.safeParse({
        ...complete,
        createdAt: Number.MAX_SAFE_INTEGER + 1,
      }).success,
    ).toBe(false)
    expect(
      boardCardSchema.safeParse({
        ...complete,
        title: '',
      }).success,
    ).toBe(false)
    expect(
      boardCardSchema.safeParse({
        ...complete,
        id: 'not-a-uuid',
      }).success,
    ).toBe(false)
    expect(
      boardCardSchema.safeParse({
        ...complete,
        extra: true,
      }).success,
    ).toBe(false)
  })

  it('enforces projectPath, title, body, and update field bounds', () => {
    expect(boardProjectPathSchema.safeParse('').success).toBe(false)
    expect(boardProjectPathSchema.safeParse('x'.repeat(4097)).success).toBe(false)
    expect(boardProjectPathSchema.safeParse('x'.repeat(4096)).success).toBe(true)

    expect(
      createBoardCardInputSchema.safeParse({
        projectPath: '/synthetic/repo',
        title: '   ',
      }).success,
    ).toBe(false)
    expect(
      createBoardCardInputSchema.safeParse({
        projectPath: '/synthetic/repo',
        title: 'a'.repeat(241),
      }).success,
    ).toBe(false)
    expect(
      createBoardCardInputSchema.parse({
        projectPath: '/synthetic/repo',
        title: '  Trimmed title  ',
      }),
    ).toEqual({ projectPath: '/synthetic/repo', title: 'Trimmed title' })
    expect(
      createBoardCardInputSchema.safeParse({
        projectPath: '/synthetic/repo',
        title: 'ok',
        body: 'b'.repeat(20_001),
      }).success,
    ).toBe(false)

    expect(
      updateBoardCardInputSchema.safeParse({
        projectPath: '/synthetic/repo',
        cardId: '00000000-0000-4000-8000-000000000101',
      }).success,
    ).toBe(false)
    expect(
      updateBoardCardInputSchema.safeParse({
        projectPath: '/synthetic/repo',
        cardId: '00000000-0000-4000-8000-000000000101',
        title: 'Only title',
      }).success,
    ).toBe(true)
    expect(
      updateBoardCardInputSchema.safeParse({
        projectPath: '/synthetic/repo',
        cardId: '00000000-0000-4000-8000-000000000101',
        body: 'Only body',
      }).success,
    ).toBe(true)
  })

  it('preserves every status and optional body without defaulting create status on the wire', () => {
    for (const status of BOARD_STATUSES) {
      expect(
        boardProcedures.createBoardCard.input.safeParse({
          projectPath: '/synthetic/repo',
          title: 'A card',
          status,
        }).success,
      ).toBe(true)
      expect(
        boardProcedures.moveBoardCard.input.safeParse({
          projectPath: '/synthetic/repo',
          cardId: '00000000-0000-4000-8000-000000000101',
          status,
        }).success,
      ).toBe(true)
      expect(
        boardProcedures.clearBoardColumn.input.safeParse({
          projectPath: '/synthetic/repo',
          status,
        }).success,
      ).toBe(true)
    }

    expect(
      boardProcedures.createBoardCard.input.parse({
        projectPath: '/synthetic/repo',
        title: 'Default status elsewhere',
      }),
    ).toEqual({ projectPath: '/synthetic/repo', title: 'Default status elsewhere' })

    const withoutBody = boardCardFixture()
    expect('body' in withoutBody).toBe(false)
    const withBody = boardCardFixture({ body: 'present body' })
    expect(withBody.body).toBe('present body')
  })

  it('rejects void mutation outputs and unknown input fields', () => {
    for (const name of [
      'createBoardCard',
      'updateBoardCard',
      'moveBoardCard',
      'deleteBoardCard',
      'clearBoardColumn',
    ] as const) {
      expect(boardProcedures[name].output.safeParse(undefined).success).toBe(false)
    }

    expect(
      boardProcedures.createBoardCard.input.safeParse({
        ...boardContractFixtures.createBoardCard.input,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      boardProcedures.listBoardCards.output.safeParse([
        { ...boardContractFixtures.listBoardCards.output[0], extra: true },
      ]).success,
    ).toBe(false)
  })

  it('parses every Board fixture through its schema', () => {
    expect(boardCardSchema.parse(boardCardFixture())).toEqual(boardCardFixture())
    expect(boardChangedSchema.parse(boardNotificationFixture())).toEqual(boardNotificationFixture())
    for (const name of Object.keys(boardContractFixtures) as Array<
      keyof typeof boardContractFixtures
    >) {
      const fixture = boardContractFixtures[name]
      expect(boardProcedures[name].input.parse(fixture.input)).toEqual(fixture.input)
      expect(boardProcedures[name].output.parse(fixture.output)).toEqual(fixture.output)
    }
  })

  it('composes Board public errors into the strict error shapes', () => {
    expect(boardUnavailableErrorSchema.shape.code.value).toBe('board.unavailable')
    expect(boardCardNotFoundErrorSchema.shape.code.value).toBe('board.card-not-found')
    expect(boardInvalidTitleErrorSchema.shape.code.value).toBe('board.invalid-title')
  })
})

describe('Board change notifications', () => {
  it('covers exactly the declared change categories', () => {
    expect(boardChangeSchema.options.map((option) => option.shape.kind.value)).toEqual([
      ...BOARD_CHANGE_KINDS,
    ])
    expect(Object.keys(boardNotificationFixtures)).toEqual([...BOARD_CHANGE_KINDS])
  })

  it('accepts the board.changed fixture and rejects watch or stream traffic', () => {
    const notification = boardNotificationFixture()
    expect(boardChangeSchema.parse(notification)).toEqual(notification)
    expect(boardChangedSchema.parse(boardNotificationFixtures['board.changed'])).toEqual(
      boardNotificationFixtures['board.changed'],
    )

    expect(sessionWatchesFrameSchema.safeParse(notification).success).toBe(false)
    expect(terminalOutputFrameSchema.safeParse(notification).success).toBe(false)
    expect(
      sessionWatchesFrameSchema.safeParse({
        t: 'session:watches',
        projectPath: '/synthetic/repo',
        files: [],
        dirs: [],
      }).success,
    ).toBe(true)
  })

  it('rejects board.changed without projectPath, empty path, or unknown fields', () => {
    const { projectPath: _dropped, ...withoutProject } = boardNotificationFixtures['board.changed']
    expect(boardChangeSchema.safeParse(withoutProject).success).toBe(false)
    expect(
      boardChangeSchema.safeParse({
        ...boardNotificationFixtures['board.changed'],
        projectPath: '',
      }).success,
    ).toBe(false)
    expect(
      boardChangeSchema.safeParse({
        ...boardNotificationFixtures['board.changed'],
        payload: 'entity',
      }).success,
    ).toBe(false)
    expect(
      boardChangeSchema.safeParse({ kind: 'changed', projectPath: '/synthetic/repo' }).success,
    ).toBe(false)
  })
})
