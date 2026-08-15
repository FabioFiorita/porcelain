import { z } from 'zod'

/**
 * Tasks are daemon-wide, not repo-local: one table per Environment daemon (issue #23,
 * stories 36–40). Nothing here carries an Environment id — the daemon that answers IS the
 * Environment, and a client that aggregates several daemons labels each row with the
 * Environment it asked. A wire field would invite a client to claim otherwise.
 */

/** Ordered Task statuses. Free-form status is deliberately not allowed: the column is filterable. */
export const TASK_STATUSES = ['todo', 'doing', 'done', 'blocked'] as const
export const taskStatusSchema = z.enum(TASK_STATUSES)
export type TaskStatus = z.infer<typeof taskStatusSchema>

/** Task title on create/update inputs: trimmed, 1–240 characters. */
export const taskTitleInputSchema = z.string().trim().min(1).max(240)

/** Optional markdown notes: at most 20_000 characters when present. */
export const taskNotesInputSchema = z.string().max(20_000)

/** One tag: trimmed, non-empty, short enough to render in a table cell. */
export const taskTagSchema = z.string().trim().min(1).max(48)
export const taskTagsSchema = z.array(taskTagSchema).max(32)

/**
 * What a Task points at inside this Environment. Both sides are optional — a Task may be
 * global to the machine — but a Worktree reference without its Project is meaningless, so
 * the shape refuses it rather than letting a client guess the owner.
 */
export const taskReferencesSchema = z
  .object({
    projectId: z.string().min(1).max(256).optional(),
    worktreeId: z.string().min(1).max(256).optional(),
  })
  .strict()
  .refine((value) => value.worktreeId === undefined || value.projectId !== undefined, {
    message: 'a worktreeId reference requires its projectId',
  })
export type TaskReferences = z.infer<typeof taskReferencesSchema>

/** An external link attached to a Task. Only http(s) — the app opens these through the host. */
export const taskLinkSchema = z
  .object({
    url: z.url().max(2048),
    label: z.string().trim().min(1).max(160),
  })
  .strict()
export const taskLinksSchema = z.array(taskLinkSchema).max(32)
export type TaskLink = z.infer<typeof taskLinkSchema>

/**
 * A file the daemon COPIED into its own store when the Task was created. `storedPath` is
 * relative to the daemon's attachment root and never an absolute host path: the wire must
 * not leak where a machine keeps its files, and a client has no business reading it directly.
 */
export const taskAttachmentSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).max(255),
    storedPath: z.string().min(1).max(1024),
    byteSize: z.int().nonnegative(),
    mime: z.string().min(1).max(255),
  })
  .strict()
export type TaskAttachment = z.infer<typeof taskAttachmentSchema>

/** Absolute source path handed to Quick Add; the daemon copies it and keeps no reference. */
export const taskAttachmentSourceSchema = z.string().min(1).max(4096)
export const taskAttachmentSourcesSchema = z.array(taskAttachmentSourceSchema).max(16)

/** One Task as returned on the wire. Every field is required except optional `notes`. */
export const taskSchema = z
  .object({
    id: z.uuid(),
    title: z.string().min(1).max(240),
    notes: taskNotesInputSchema.optional(),
    status: taskStatusSchema,
    tags: taskTagsSchema,
    references: taskReferencesSchema,
    attachments: z.array(taskAttachmentSchema),
    links: taskLinksSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()
export type Task = z.infer<typeof taskSchema>

// --- listTasks ---

export const listTasksInputSchema = z.void()
export const listTasksOutputSchema = z.array(taskSchema)
export type ListTasksOutput = z.infer<typeof listTasksOutputSchema>

// --- createTask ---

export const createTaskInputSchema = z
  .object({
    title: taskTitleInputSchema,
    notes: taskNotesInputSchema.optional(),
    status: taskStatusSchema.optional(),
    tags: taskTagsSchema.optional(),
    references: taskReferencesSchema.optional(),
    links: taskLinksSchema.optional(),
    /** Absolute host paths the daemon copies into its own attachment store. */
    attachmentPaths: taskAttachmentSourcesSchema.optional(),
  })
  .strict()
export const createTaskOutputSchema = taskSchema
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>
export type CreateTaskOutput = z.infer<typeof createTaskOutputSchema>

// --- updateTask ---

export const updateTaskInputSchema = z
  .object({
    taskId: z.uuid(),
    title: taskTitleInputSchema.optional(),
    notes: taskNotesInputSchema.optional(),
    status: taskStatusSchema.optional(),
    tags: taskTagsSchema.optional(),
    references: taskReferencesSchema.optional(),
    links: taskLinksSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.title !== undefined ||
      value.notes !== undefined ||
      value.status !== undefined ||
      value.tags !== undefined ||
      value.references !== undefined ||
      value.links !== undefined,
    { message: 'updateTask requires at least one field to change' },
  )
export const updateTaskOutputSchema = taskSchema
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>
export type UpdateTaskOutput = z.infer<typeof updateTaskOutputSchema>

// --- deleteTask ---

export const deleteTaskInputSchema = z.object({ taskId: z.uuid() }).strict()
export const deleteTaskOutputSchema = z.object({ taskId: z.uuid() }).strict()
export type DeleteTaskInput = z.infer<typeof deleteTaskInputSchema>
export type DeleteTaskOutput = z.infer<typeof deleteTaskOutputSchema>
