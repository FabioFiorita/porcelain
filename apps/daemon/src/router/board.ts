import { z } from 'zod'
import {
  addCard,
  type BoardCard,
  CARD_STATUSES,
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
    .input(z.string())
    .query(({ input }): Promise<BoardCard[]> => readCards(input)),

  addBoardCard: publicProcedure
    .input(
      z.object({
        repoPath: z.string(),
        title: z.string().min(1),
        body: z.string().optional(),
        status: z.enum(CARD_STATUSES).optional(),
      }),
    )
    .mutation(({ input }): Promise<BoardCard> => {
      const { repoPath, ...card } = input
      return addCard(repoPath, card)
    }),

  updateBoardCard: publicProcedure
    .input(
      z.object({
        repoPath: z.string(),
        id: z.string(),
        title: z.string().min(1).optional(),
        body: z.string().optional(),
      }),
    )
    .mutation(({ input }) =>
      updateCard(input.repoPath, input.id, { title: input.title, body: input.body }),
    ),

  moveBoardCard: publicProcedure
    .input(z.object({ repoPath: z.string(), id: z.string(), status: z.enum(CARD_STATUSES) }))
    .mutation(({ input }) => moveCard(input.repoPath, input.id, input.status)),

  deleteBoardCard: publicProcedure
    .input(z.object({ repoPath: z.string(), id: z.string() }))
    .mutation(({ input }) => deleteCard(input.repoPath, input.id)),

  clearBoardCards: publicProcedure
    .input(z.object({ repoPath: z.string(), status: z.enum(CARD_STATUSES) }))
    .mutation(({ input }) => clearCards(input.repoPath, input.status)),
})
