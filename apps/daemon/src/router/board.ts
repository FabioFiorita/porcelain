import { procedureCatalog } from '@porcelain/contracts'
import {
  addCard,
  type BoardCard,
  clearCards,
  deleteCard,
  moveCard,
  readCards,
  updateCard,
} from '../stores/board-store'
import { publicProcedure, t } from '../trpc'

export const boardRouter = t.router({
  // Project board — todo/doing/done cards the human and the agent both manage,
  // stored in <repo>/.porcelain/board.json (see `board-store.ts`); a two-way channel the
  // agent reads (`board list`) and mutates (`board create/update/move/delete`) via the CLI.
  boardCards: publicProcedure
    .input(procedureCatalog.boardCards.input)
    .output(procedureCatalog.boardCards.output)
    .query(({ input }): Promise<BoardCard[]> => readCards(input)),

  addBoardCard: publicProcedure
    .input(procedureCatalog.addBoardCard.input)
    .output(procedureCatalog.addBoardCard.output)
    .mutation(({ input }): Promise<BoardCard> => {
      const { repoPath, ...card } = input
      return addCard(repoPath, card)
    }),

  updateBoardCard: publicProcedure
    .input(procedureCatalog.updateBoardCard.input)
    .output(procedureCatalog.updateBoardCard.output)
    .mutation(({ input }) =>
      updateCard(input.repoPath, input.id, { title: input.title, body: input.body }),
    ),

  moveBoardCard: publicProcedure
    .input(procedureCatalog.moveBoardCard.input)
    .output(procedureCatalog.moveBoardCard.output)
    .mutation(({ input }) => moveCard(input.repoPath, input.id, input.status)),

  deleteBoardCard: publicProcedure
    .input(procedureCatalog.deleteBoardCard.input)
    .output(procedureCatalog.deleteBoardCard.output)
    .mutation(({ input }) => deleteCard(input.repoPath, input.id)),

  clearBoardCards: publicProcedure
    .input(procedureCatalog.clearBoardCards.input)
    .output(procedureCatalog.clearBoardCards.output)
    .mutation(({ input }) => clearCards(input.repoPath, input.status)),
})
