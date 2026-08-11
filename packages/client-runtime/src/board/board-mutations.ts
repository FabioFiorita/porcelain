import {
  boardProcedures,
  type ClearBoardColumnInput,
  type CreateBoardCardInput,
  type DeleteBoardCardInput,
  type MoveBoardCardInput,
  type UpdateBoardCardInput,
} from '@porcelain/contracts/board'
import { type BoardCardsQuery, boardCardsQuery } from './board-queries'

/**
 * Board mutation consequence definitions (BRD-003).
 *
 * Each entry binds exactly one BRD-001 canonical procedure, the cards query identity it
 * affects, and the authoritative-refetch requirement. Transport and React stay in adapters.
 */

/** Canonical Board procedure objects from BRD-001 (query + five mutations). */
type BoardProcedure = (typeof boardProcedures)[keyof typeof boardProcedures]

export type BoardMutationDefinition<TInput> = {
  /** Canonical BRD-001 procedure contract object (not a free-form invalidation string). */
  readonly procedure: BoardProcedure
  /** Catalog key of the bound BRD-001 procedure. */
  readonly procedureName: keyof typeof boardProcedures
  readonly affectedQueries: (input: TInput) => readonly BoardCardsQuery[]
  readonly requiresAuthoritativeRefetch: true
}

export const boardMutations = {
  create: {
    procedure: boardProcedures.createBoardCard,
    procedureName: 'createBoardCard',
    affectedQueries: (input: CreateBoardCardInput): readonly BoardCardsQuery[] => [
      boardCardsQuery(input.projectPath),
    ],
    requiresAuthoritativeRefetch: true,
  },
  update: {
    procedure: boardProcedures.updateBoardCard,
    procedureName: 'updateBoardCard',
    affectedQueries: (input: UpdateBoardCardInput): readonly BoardCardsQuery[] => [
      boardCardsQuery(input.projectPath),
    ],
    requiresAuthoritativeRefetch: true,
  },
  move: {
    procedure: boardProcedures.moveBoardCard,
    procedureName: 'moveBoardCard',
    affectedQueries: (input: MoveBoardCardInput): readonly BoardCardsQuery[] => [
      boardCardsQuery(input.projectPath),
    ],
    requiresAuthoritativeRefetch: true,
  },
  delete: {
    procedure: boardProcedures.deleteBoardCard,
    procedureName: 'deleteBoardCard',
    affectedQueries: (input: DeleteBoardCardInput): readonly BoardCardsQuery[] => [
      boardCardsQuery(input.projectPath),
    ],
    requiresAuthoritativeRefetch: true,
  },
  clearColumn: {
    procedure: boardProcedures.clearBoardColumn,
    procedureName: 'clearBoardColumn',
    affectedQueries: (input: ClearBoardColumnInput): readonly BoardCardsQuery[] => [
      boardCardsQuery(input.projectPath),
    ],
    requiresAuthoritativeRefetch: true,
  },
} as const satisfies {
  readonly create: BoardMutationDefinition<CreateBoardCardInput>
  readonly update: BoardMutationDefinition<UpdateBoardCardInput>
  readonly move: BoardMutationDefinition<MoveBoardCardInput>
  readonly delete: BoardMutationDefinition<DeleteBoardCardInput>
  readonly clearColumn: BoardMutationDefinition<ClearBoardColumnInput>
}

export type BoardMutation = (typeof boardMutations)[keyof typeof boardMutations]
