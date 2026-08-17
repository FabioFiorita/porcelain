import type {
  Task,
  TaskAttachment,
  TaskLink,
  TaskReferences,
  TaskStatus,
} from '@porcelain/contracts/tasks'

/** Expected store/adapter failure: host I/O or an unusable document. */
export type TasksUnavailableError = { readonly code: 'tasks.unavailable' }

export type TasksNotFoundError = { readonly code: 'tasks.not-found'; readonly taskId: string }

export type TasksInvalidTitleError = {
  readonly code: 'tasks.invalid-title'
  readonly reason: 'blank' | 'too-long'
  readonly maxLength: 240
}

export type TasksAttachmentRejectedReason =
  | 'not-absolute'
  | 'not-found'
  | 'not-a-file'
  | 'too-large'
  | 'unsafe-name'
  | 'invalid-bytes'

export type TasksAttachmentRejectedError = {
  readonly code: 'tasks.attachment-rejected'
  readonly reason: TasksAttachmentRejectedReason
}

export type TasksError =
  | TasksUnavailableError
  | TasksNotFoundError
  | TasksInvalidTitleError
  | TasksAttachmentRejectedError

export type TasksResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: TasksError }

export type TasksStoreResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: TasksUnavailableError }

/**
 * The daemon-wide Tasks table. `transact` serializes read-modify-write so two concurrent
 * mutations cannot lose each other's row; the planner it takes returns the next full table
 * or a domain rejection, and only a durable write resolves `ok`.
 */
export type TasksStore = Readonly<{
  read(): Promise<TasksStoreResult<Task[]>>
  transact<Value>(
    plan: (current: Task[]) => TasksResult<{ tasks: Task[]; value: Value }>,
  ): Promise<TasksResult<Value>>
}>

/**
 * Copies a Quick Add source file into this daemon's attachment store. Confinement is the
 * adapter's job: it owns the destination path, so no caller-supplied name can escape it.
 */
export type TasksAttachments = Readonly<{
  copyInto(taskId: string, sourcePath: string): Promise<TasksResult<TaskAttachment>>
  writeBytes(taskId: string, name: string, bytes: Uint8Array): Promise<TasksResult<TaskAttachment>>
  read(storedPath: string): Promise<TasksResult<Uint8Array>>
  removeOne(storedPath: string): Promise<void>
  discard(taskId: string): Promise<void>
}>

export type TasksClock = Readonly<{ now(): string }>
export type TasksIds = Readonly<{ create(): string }>

/** Domain-facing change fact. The publisher maps it onto the session change vocabulary. */
export type TasksChanges = Readonly<{ publish(change: { type: 'tasks.changed' }): void }>

export type { Task, TaskAttachment, TaskLink, TaskReferences, TaskStatus }
