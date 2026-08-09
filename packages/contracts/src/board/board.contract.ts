import { z } from 'zod'

export const BOARD_STATUSES = ['todo', 'doing', 'done'] as const
export const boardStatusSchema = z.enum(BOARD_STATUSES)
export type BoardStatus = z.infer<typeof boardStatusSchema>

export const boardCardSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    body: z.string().optional(),
    status: boardStatusSchema,
    order: z.number(),
    createdAt: z.number(),
  })
  .strict()

export type BoardCard = z.infer<typeof boardCardSchema>

export const boardCardsInputSchema = z.string()
export const boardCardsOutputSchema = z.array(boardCardSchema)
export type BoardCardsInput = z.infer<typeof boardCardsInputSchema>
export type BoardCardsOutput = z.infer<typeof boardCardsOutputSchema>

export const addBoardCardInputSchema = z
  .object({
    repoPath: z.string(),
    title: z.string().min(1),
    body: z.string().optional(),
    status: boardStatusSchema.optional(),
  })
  .strict()
export const addBoardCardOutputSchema = boardCardSchema
export type AddBoardCardInput = z.infer<typeof addBoardCardInputSchema>
export type AddBoardCardOutput = z.infer<typeof addBoardCardOutputSchema>

export const updateBoardCardInputSchema = z
  .object({
    repoPath: z.string(),
    id: z.string(),
    title: z.string().min(1).optional(),
    body: z.string().optional(),
  })
  .strict()
export const updateBoardCardOutputSchema = z.void()
export type UpdateBoardCardInput = z.infer<typeof updateBoardCardInputSchema>
export type UpdateBoardCardOutput = z.infer<typeof updateBoardCardOutputSchema>

export const moveBoardCardInputSchema = z
  .object({
    repoPath: z.string(),
    id: z.string(),
    status: boardStatusSchema,
  })
  .strict()
export const moveBoardCardOutputSchema = z.void()
export type MoveBoardCardInput = z.infer<typeof moveBoardCardInputSchema>
export type MoveBoardCardOutput = z.infer<typeof moveBoardCardOutputSchema>

export const deleteBoardCardInputSchema = z
  .object({
    repoPath: z.string(),
    id: z.string(),
  })
  .strict()
export const deleteBoardCardOutputSchema = z.void()
export type DeleteBoardCardInput = z.infer<typeof deleteBoardCardInputSchema>
export type DeleteBoardCardOutput = z.infer<typeof deleteBoardCardOutputSchema>

export const clearBoardCardsInputSchema = z
  .object({
    repoPath: z.string(),
    status: boardStatusSchema,
  })
  .strict()
export const clearBoardCardsOutputSchema = z.void()
export type ClearBoardCardsInput = z.infer<typeof clearBoardCardsInputSchema>
export type ClearBoardCardsOutput = z.infer<typeof clearBoardCardsOutputSchema>

export { boardContractFixtures } from './board.fixtures'
