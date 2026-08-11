import { createValidatingDaemonMock } from '@porcelain/client-runtime/testing/daemon-mock'
import { publicErrorSchema } from '@porcelain/contracts'
import {
  boardContractFixtures,
  boardProcedures,
  boardProjectPathSchema,
} from '@porcelain/contracts/board'
import { describe, expect, it } from 'vitest'
import { boardMutations } from './board-mutations'
import { boardCardsQuery } from './board-queries'

const OTHER_PATH = boardProjectPathSchema.parse('/synthetic/other-repo')
const fixtures = boardContractFixtures

const boardProcedureCatalog = {
  procedures: boardProcedures,
  notification: { parse: (value: unknown) => value },
  publicError: publicErrorSchema,
}

describe('boardMutations', () => {
  it('binds each definition to exactly one canonical BRD-001 procedure', () => {
    expect(boardMutations.create.procedure).toBe(boardProcedures.createBoardCard)
    expect(boardMutations.create.procedureName).toBe('createBoardCard')

    expect(boardMutations.update.procedure).toBe(boardProcedures.updateBoardCard)
    expect(boardMutations.update.procedureName).toBe('updateBoardCard')

    expect(boardMutations.move.procedure).toBe(boardProcedures.moveBoardCard)
    expect(boardMutations.move.procedureName).toBe('moveBoardCard')

    expect(boardMutations.delete.procedure).toBe(boardProcedures.deleteBoardCard)
    expect(boardMutations.delete.procedureName).toBe('deleteBoardCard')

    expect(boardMutations.clearColumn.procedure).toBe(boardProcedures.clearBoardColumn)
    expect(boardMutations.clearColumn.procedureName).toBe('clearBoardColumn')
  })

  it('affects only the cards identity for the input Project path', () => {
    const cases = [
      {
        definition: boardMutations.create,
        input: fixtures.createBoardCard.input,
      },
      {
        definition: boardMutations.update,
        input: fixtures.updateBoardCard.input,
      },
      {
        definition: boardMutations.move,
        input: fixtures.moveBoardCard.input,
      },
      {
        definition: boardMutations.delete,
        input: fixtures.deleteBoardCard.input,
      },
      {
        definition: boardMutations.clearColumn,
        input: fixtures.clearBoardColumn.input,
      },
    ] as const

    for (const { definition, input } of cases) {
      const affected = definition.affectedQueries(input)
      expect(affected).toEqual([boardCardsQuery(input.projectPath)])
      expect(affected).toHaveLength(1)
      expect(affected[0]).not.toEqual(boardCardsQuery(OTHER_PATH))
      expect(definition.requiresAuthoritativeRefetch).toBe(true)
    }
  })

  it('dispatches bound procedures through the validating daemon mock', async () => {
    const daemon = createValidatingDaemonMock(boardProcedureCatalog, {
      createBoardCard: () => ({ ok: true, value: fixtures.createBoardCard.output }),
      updateBoardCard: () => ({ ok: true, value: fixtures.updateBoardCard.output }),
      moveBoardCard: () => ({ ok: true, value: fixtures.moveBoardCard.output }),
      deleteBoardCard: () => ({ ok: true, value: fixtures.deleteBoardCard.output }),
      clearBoardColumn: () => ({ ok: true, value: fixtures.clearBoardColumn.output }),
    })

    const outcomes = await Promise.all([
      daemon.dispatch({
        procedure: boardMutations.create.procedureName,
        kind: boardMutations.create.procedure.kind,
        input: fixtures.createBoardCard.input,
      }),
      daemon.dispatch({
        procedure: boardMutations.update.procedureName,
        kind: boardMutations.update.procedure.kind,
        input: fixtures.updateBoardCard.input,
      }),
      daemon.dispatch({
        procedure: boardMutations.move.procedureName,
        kind: boardMutations.move.procedure.kind,
        input: fixtures.moveBoardCard.input,
      }),
      daemon.dispatch({
        procedure: boardMutations.delete.procedureName,
        kind: boardMutations.delete.procedure.kind,
        input: fixtures.deleteBoardCard.input,
      }),
      daemon.dispatch({
        procedure: boardMutations.clearColumn.procedureName,
        kind: boardMutations.clearColumn.procedure.kind,
        input: fixtures.clearBoardColumn.input,
      }),
    ])

    expect(outcomes.map((outcome) => outcome.ok)).toEqual([true, true, true, true, true])
    expect(daemon.requests().map((request) => request.procedure)).toEqual([
      'createBoardCard',
      'updateBoardCard',
      'moveBoardCard',
      'deleteBoardCard',
      'clearBoardColumn',
    ])
  })
})
