import { createValidatingDaemonMock } from '@porcelain/client-runtime/testing/daemon-mock'
import { publicErrorSchema } from '@porcelain/contracts'
import {
  boardContractFixtures,
  boardProcedures,
  boardProjectPathSchema,
} from '@porcelain/contracts/board'
import { mutableFixture } from '@porcelain/contracts/testing'
import { describe, expect, it } from 'vitest'
import { boardMutations } from './board-mutations'
import type { BoardCardsQuery } from './board-queries'
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
    // Resolved where the definition and its input are still paired. Carrying them through an
    // array unions the two fields independently, so `affectedQueries` ends up demanding the
    // intersection of every input shape and no fixture satisfies it.
    const bind = <Input extends { projectPath: string }>(
      definition: {
        readonly affectedQueries: (input: Input) => readonly BoardCardsQuery[]
        readonly requiresAuthoritativeRefetch: boolean
      },
      input: Input,
    ) => ({
      affected: definition.affectedQueries(input),
      projectPath: input.projectPath,
      requiresAuthoritativeRefetch: definition.requiresAuthoritativeRefetch,
    })

    const cases = [
      bind(boardMutations.create, mutableFixture(fixtures.createBoardCard.input)),
      bind(boardMutations.update, mutableFixture(fixtures.updateBoardCard.input)),
      bind(boardMutations.move, mutableFixture(fixtures.moveBoardCard.input)),
      bind(boardMutations.delete, mutableFixture(fixtures.deleteBoardCard.input)),
      bind(boardMutations.clearColumn, mutableFixture(fixtures.clearBoardColumn.input)),
    ]

    for (const bound of cases) {
      const affected = bound.affected
      expect(affected).toEqual([boardCardsQuery(bound.projectPath)])
      expect(affected).toHaveLength(1)
      expect(affected[0]).not.toEqual(boardCardsQuery(OTHER_PATH))
      expect(bound.requiresAuthoritativeRefetch).toBe(true)
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
