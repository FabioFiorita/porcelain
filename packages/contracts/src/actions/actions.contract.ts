import { z } from 'zod'

export const ACTION_WHERE_VALUES = ['primary', 'local'] as const
export const actionWhereSchema = z.enum(ACTION_WHERE_VALUES)
export type ActionWhere = z.infer<typeof actionWhereSchema>

export const ACTION_MOVE_DIRECTIONS = ['up', 'down'] as const
export const actionMoveDirectionSchema = z.enum(ACTION_MOVE_DIRECTIONS)
export type ActionMoveDirection = z.infer<typeof actionMoveDirectionSchema>

/** The stored action as it lives in `<repo>/.porcelain/actions.json`. */
export const actionSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    command: z.string(),
    where: actionWhereSchema.optional(),
    order: z.number().default(0),
    createdAt: z.number().default(0),
  })
  .strict()

export type Action = z.infer<typeof actionSchema>

/**
 * A stored action plus whether this machine's human has accepted its command text.
 * `trusted` is derived per read by the daemon and never stored on disk — a repo must
 * not be able to vouch for its own commands.
 */
export const actionViewSchema = actionSchema
  .extend({
    trusted: z.boolean().default(false),
  })
  .strict()

export type ActionView = z.infer<typeof actionViewSchema>

export const actionsInputSchema = z.string()
export const actionsOutputSchema = z.array(actionViewSchema)
export type ActionsInput = z.infer<typeof actionsInputSchema>
export type ActionsOutput = z.infer<typeof actionsOutputSchema>

export const trustActionsInputSchema = z
  .object({
    repoPath: z.string(),
    ids: z.array(z.string()).min(1),
  })
  .strict()
export const trustActionsOutputSchema = z.void()
export type TrustActionsInput = z.infer<typeof trustActionsInputSchema>
export type TrustActionsOutput = z.infer<typeof trustActionsOutputSchema>

export const addActionInputSchema = z
  .object({
    repoPath: z.string(),
    title: z.string().trim().min(1),
    command: z.string().trim().min(1),
    where: actionWhereSchema.optional(),
  })
  .strict()
export const addActionOutputSchema = actionSchema
export type AddActionInput = z.infer<typeof addActionInputSchema>
export type AddActionOutput = z.infer<typeof addActionOutputSchema>

export const updateActionInputSchema = z
  .object({
    repoPath: z.string(),
    id: z.string(),
    title: z.string().trim().min(1).optional(),
    command: z.string().trim().min(1).optional(),
    where: actionWhereSchema.optional(),
  })
  .strict()
export const updateActionOutputSchema = z.void()
export type UpdateActionInput = z.infer<typeof updateActionInputSchema>
export type UpdateActionOutput = z.infer<typeof updateActionOutputSchema>

export const moveActionInputSchema = z
  .object({
    repoPath: z.string(),
    id: z.string(),
    direction: actionMoveDirectionSchema,
  })
  .strict()
export const moveActionOutputSchema = z.void()
export type MoveActionInput = z.infer<typeof moveActionInputSchema>
export type MoveActionOutput = z.infer<typeof moveActionOutputSchema>

export const deleteActionInputSchema = z
  .object({
    repoPath: z.string(),
    id: z.string(),
  })
  .strict()
export const deleteActionOutputSchema = z.void()
export type DeleteActionInput = z.infer<typeof deleteActionInputSchema>
export type DeleteActionOutput = z.infer<typeof deleteActionOutputSchema>

export { actionsContractFixtures } from './actions.fixtures'
