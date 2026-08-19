import { z } from 'zod'

export const ACTION_WHERE_VALUES = ['primary', 'local'] as const
export const actionWhereSchema = z.enum(ACTION_WHERE_VALUES)
export type ActionWhere = z.infer<typeof actionWhereSchema>

/**
 * What a saved command *is for*. `action` is the human's one-click command; the two
 * worktree roles are lifecycle scripts Porcelain itself runs when a Worktree is created
 * or removed. They share this table because they share everything that matters — Project
 * ownership, command text, ordering, and the per-machine trust gate — and differ only in
 * who presses go. Absent on the wire and on disk means `action`, so every row written
 * before this field reads back as exactly what it was.
 */
export const ACTION_KINDS = ['action', 'worktree-setup', 'worktree-dispose'] as const
export const actionKindSchema = z.enum(ACTION_KINDS)
export type ActionKind = z.infer<typeof actionKindSchema>

/** The two roles Porcelain runs itself, in list order, around a Worktree's lifetime. */
export const WORKTREE_SCRIPT_KINDS = ['worktree-setup', 'worktree-dispose'] as const
export const worktreeScriptKindSchema = z.enum(WORKTREE_SCRIPT_KINDS)
export type WorktreeScriptKind = z.infer<typeof worktreeScriptKindSchema>

export const ACTION_MOVE_DIRECTIONS = ['up', 'down'] as const
export const actionMoveDirectionSchema = z.enum(ACTION_MOVE_DIRECTIONS)
export type ActionMoveDirection = z.infer<typeof actionMoveDirectionSchema>

/**
 * The stored action as it lives in the owning daemon's Project store
 * (`$PORCELAIN_HOME/projects/<projectId>/actions.json`, ADR 0002) — never in the
 * checkout, so an Action outlives the Worktree an agent created it from.
 */
export const actionSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    command: z.string(),
    where: actionWhereSchema.optional(),
    kind: actionKindSchema.default('action'),
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

/**
 * The explicit Environment + Project + Worktree an Action runs against. Actions are
 * stored per Project but a Project has many checkouts, so nothing may infer which one
 * a command executes in: the caller states it and the daemon verifies it (#24).
 */
export const actionRunTargetSchema = z
  .object({
    environmentId: z.string().min(1),
    projectId: z.string().min(1),
    worktreeId: z.string().min(1),
    /** Absolute Worktree checkout path; must be a live Worktree of `projectId`. */
    path: z.string().min(1),
  })
  .strict()
export type ActionRunTarget = z.infer<typeof actionRunTargetSchema>

const projectIdSchema = z.string().min(1)

export const actionsInputSchema = z.object({ projectId: projectIdSchema }).strict()
export const actionsOutputSchema = z.array(actionViewSchema)
export type ActionsInput = z.infer<typeof actionsInputSchema>
export type ActionsOutput = z.infer<typeof actionsOutputSchema>

export const trustActionsInputSchema = z
  .object({
    projectId: projectIdSchema,
    ids: z.array(z.string()).min(1),
  })
  .strict()
export const trustActionsOutputSchema = z.void()
export type TrustActionsInput = z.infer<typeof trustActionsInputSchema>
export type TrustActionsOutput = z.infer<typeof trustActionsOutputSchema>

export const addActionInputSchema = z
  .object({
    projectId: projectIdSchema,
    title: z.string().trim().min(1),
    command: z.string().trim().min(1),
    where: actionWhereSchema.optional(),
    kind: actionKindSchema.optional(),
  })
  .strict()
export const addActionOutputSchema = actionSchema
export type AddActionInput = z.infer<typeof addActionInputSchema>
export type AddActionOutput = z.infer<typeof addActionOutputSchema>

export const updateActionInputSchema = z
  .object({
    projectId: projectIdSchema,
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
    projectId: projectIdSchema,
    id: z.string(),
    direction: actionMoveDirectionSchema,
  })
  .strict()
export const moveActionOutputSchema = z.void()
export type MoveActionInput = z.infer<typeof moveActionInputSchema>
export type MoveActionOutput = z.infer<typeof moveActionOutputSchema>

export const deleteActionInputSchema = z
  .object({
    projectId: projectIdSchema,
    id: z.string(),
  })
  .strict()
export const deleteActionOutputSchema = z.void()
export type DeleteActionInput = z.infer<typeof deleteActionInputSchema>
export type DeleteActionOutput = z.infer<typeof deleteActionOutputSchema>

/**
 * Ask the owning daemon to authorize one run: the Action must exist in that
 * Project, its command text must be trusted on that machine, and `target` must
 * name a Worktree the daemon itself knows for that Project. The daemon returns
 * the command and the absolute `cwd` the client then spawns a terminal in — it
 * never spawns anything itself (the human presses Run).
 */
export const prepareActionRunInputSchema = z
  .object({
    actionId: z.string().min(1),
    target: actionRunTargetSchema,
  })
  .strict()
export const prepareActionRunOutputSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    command: z.string(),
    where: actionWhereSchema,
    /** Verified Worktree checkout the command runs in. */
    cwd: z.string(),
  })
  .strict()
export type PrepareActionRunInput = z.infer<typeof prepareActionRunInputSchema>
export type PrepareActionRunOutput = z.infer<typeof prepareActionRunOutputSchema>

export { actionsContractFixtures } from './actions.fixtures'
