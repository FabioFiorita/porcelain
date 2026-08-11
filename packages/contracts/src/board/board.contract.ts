import { z } from 'zod'

/** Ordered Board columns. Server-owned card identity and timestamps never default on the wire. */
export const BOARD_STATUSES = ['todo', 'doing', 'done'] as const
export const boardStatusSchema = z.enum(BOARD_STATUSES)
export type BoardStatus = z.infer<typeof boardStatusSchema>

/** Absolute Project path on the wire: non-empty, bounded. */
export const boardProjectPathSchema = z.string().min(1).max(4096)
export type BoardProjectPath = z.infer<typeof boardProjectPathSchema>

/** Nonnegative safe integer for order and creation time. */
export const boardSafeNonNegativeIntSchema = z.int().nonnegative()

/** Card title on create/update inputs: trimmed, 1–240 characters. */
export const boardTitleInputSchema = z.string().trim().min(1).max(240)

/** Optional body: at most 20_000 characters when present. */
export const boardBodyInputSchema = z.string().max(20_000)

/**
 * One Board card as returned on the wire. Every field is required except optional `body`.
 * No defaults — missing identity, status, order, or time is a contract failure.
 */
export const boardCardSchema = z
  .object({
    id: z.uuid(),
    title: z.string().min(1).max(240),
    body: boardBodyInputSchema.optional(),
    status: boardStatusSchema,
    order: boardSafeNonNegativeIntSchema,
    createdAt: boardSafeNonNegativeIntSchema,
  })
  .strict()

export type BoardCard = z.infer<typeof boardCardSchema>

// --- listBoardCards ---

export const listBoardCardsInputSchema = boardProjectPathSchema
export const listBoardCardsOutputSchema = z.array(boardCardSchema)
export type ListBoardCardsInput = z.infer<typeof listBoardCardsInputSchema>
export type ListBoardCardsOutput = z.infer<typeof listBoardCardsOutputSchema>

// --- createBoardCard ---

export const createBoardCardInputSchema = z
  .object({
    projectPath: boardProjectPathSchema,
    title: boardTitleInputSchema,
    body: boardBodyInputSchema.optional(),
    status: boardStatusSchema.optional(),
  })
  .strict()
export const createBoardCardOutputSchema = boardCardSchema
export type CreateBoardCardInput = z.infer<typeof createBoardCardInputSchema>
export type CreateBoardCardOutput = z.infer<typeof createBoardCardOutputSchema>

// --- updateBoardCard ---

export const updateBoardCardInputSchema = z
  .object({
    projectPath: boardProjectPathSchema,
    cardId: z.uuid(),
    title: boardTitleInputSchema.optional(),
    body: boardBodyInputSchema.optional(),
  })
  .strict()
  .refine((value) => value.title !== undefined || value.body !== undefined, {
    message: 'updateBoardCard requires title or body',
  })
export const updateBoardCardOutputSchema = boardCardSchema
export type UpdateBoardCardInput = z.infer<typeof updateBoardCardInputSchema>
export type UpdateBoardCardOutput = z.infer<typeof updateBoardCardOutputSchema>

// --- moveBoardCard ---

export const moveBoardCardInputSchema = z
  .object({
    projectPath: boardProjectPathSchema,
    cardId: z.uuid(),
    status: boardStatusSchema,
  })
  .strict()
export const moveBoardCardOutputSchema = boardCardSchema
export type MoveBoardCardInput = z.infer<typeof moveBoardCardInputSchema>
export type MoveBoardCardOutput = z.infer<typeof moveBoardCardOutputSchema>

// --- deleteBoardCard ---

export const deleteBoardCardInputSchema = z
  .object({
    projectPath: boardProjectPathSchema,
    cardId: z.uuid(),
  })
  .strict()
export const deleteBoardCardOutputSchema = z
  .object({
    cardId: z.uuid(),
  })
  .strict()
export type DeleteBoardCardInput = z.infer<typeof deleteBoardCardInputSchema>
export type DeleteBoardCardOutput = z.infer<typeof deleteBoardCardOutputSchema>

// --- clearBoardColumn ---

export const clearBoardColumnInputSchema = z
  .object({
    projectPath: boardProjectPathSchema,
    status: boardStatusSchema,
  })
  .strict()
export const clearBoardColumnOutputSchema = z
  .object({
    status: boardStatusSchema,
    cardIds: z.array(z.uuid()),
  })
  .strict()
export type ClearBoardColumnInput = z.infer<typeof clearBoardColumnInputSchema>
export type ClearBoardColumnOutput = z.infer<typeof clearBoardColumnOutputSchema>
