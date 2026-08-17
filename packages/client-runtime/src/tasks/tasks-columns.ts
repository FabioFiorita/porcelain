/**
 * The Tasks table's configurable columns.
 *
 * Which columns are shown and in what order is a PERSONAL presentation choice: it lives in a
 * client-local persisted store and is never written to a daemon or a repository (issue #18's
 * "personal UI state stays client-local"). This module owns only the vocabulary — the ids,
 * their labels, and the default view — so Web and a later mobile client cannot drift.
 */

export const TASK_COLUMN_IDS = [
  'id',
  'status',
  'title',
  'project',
  'links',
  'updated',
  'tags',
  'worktree',
  'created',
] as const

export type TaskColumnId = (typeof TASK_COLUMN_IDS)[number]

export const TASK_COLUMN_LABELS: Readonly<Record<TaskColumnId, string>> = {
  id: 'ID',
  status: 'Status',
  title: 'Title',
  project: 'Project',
  links: 'URL',
  updated: 'Updated',
  tags: 'Tags',
  worktree: 'Worktree',
  created: 'Created',
}

/**
 * `TASK_COLUMN_IDS` IS the default order — there is no separate default constant, because two
 * lists that must stay identical eventually will not.
 */

/** Title is not optional: a row with no title column is not a table, it is a puzzle. */
export const TASK_REQUIRED_COLUMN_IDS: readonly TaskColumnId[] = ['title']

export const DEFAULT_HIDDEN_TASK_COLUMN_IDS: readonly TaskColumnId[] = [
  'tags',
  'worktree',
  'created',
]

/**
 * Reconcile a persisted column preference against the current vocabulary: unknown ids are
 * dropped (a build that removed a column must not resurrect it), a repeated id is kept once
 * (a duplicate would render the same column twice), and newly added ids append in their
 * canonical position, so an upgrade shows the new column rather than hiding it.
 */
export function resolveTaskColumnOrder(persisted: readonly string[]): TaskColumnId[] {
  const known = new Set<string>(TASK_COLUMN_IDS)
  const kept = [...new Set(persisted.filter((id): id is TaskColumnId => known.has(id)))]
  const seen = new Set<TaskColumnId>(kept)
  return [...kept, ...TASK_COLUMN_IDS.filter((id) => !seen.has(id))]
}

/** A hidden set is only ever a subset of the optional columns. */
export function resolveHiddenTaskColumns(persisted: readonly string[]): TaskColumnId[] {
  const required = new Set<string>(TASK_REQUIRED_COLUMN_IDS)
  const known = new Set<string>(TASK_COLUMN_IDS)
  return [
    ...new Set(persisted.filter((id) => known.has(id) && !required.has(id))),
  ] as TaskColumnId[]
}
