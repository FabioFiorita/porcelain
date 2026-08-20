import type { TaskRow } from '@porcelain/client-runtime/tasks'
import { OPEN_TASK_STATUSES, TASK_STATUS_LABELS } from '@porcelain/client-runtime/tasks'
import { TASK_STATUSES, type TaskStatus } from '@porcelain/contracts/tasks'

/**
 * The board's status scope — mobile's shape for the filter Web spends a multi-select dropdown
 * on.
 *
 * Web can hold an arbitrary SET of statuses because a dropdown has room for four checkboxes
 * next to a text field. A phone's filter is a segmented control, which is single-choice by
 * construction, so the vocabulary is the scopes a person actually asks for: everything still
 * open, or one named status. The `open` scope is `OPEN_TASK_STATUSES` — the one shared set Web
 * opens its filter on — so the rule the owner cares about, Done is hidden until asked for,
 * cannot drift between the two clients. Only this control vocabulary is mobile's; the rule and
 * the status names are not.
 *
 * Like Web's, the scope is per-session state and never persisted: "hidden by default" has to be
 * true on every cold start, which a stored preference cannot promise.
 */

export const TASK_STATUS_SCOPES = ['open', ...TASK_STATUSES] as const
export type TaskStatusScope = (typeof TASK_STATUS_SCOPES)[number]

/** Done is hidden until the control asks for it — Web's opening filter, as one value. */
export const DEFAULT_TASK_STATUS_SCOPE: TaskStatusScope = 'open'

export const TASK_STATUS_SCOPE_LABELS: Readonly<Record<TaskStatusScope, string>> = {
  open: 'Open',
  ...TASK_STATUS_LABELS,
}

/** The statuses a scope admits, always in `TASK_STATUSES` order. */
export function statusesInScope(scope: TaskStatusScope): readonly TaskStatus[] {
  if (scope === 'open') return OPEN_TASK_STATUSES
  return [scope]
}

/** One segment of the filter control. */
export function taskStatusScopeOptions(): {
  value: TaskStatusScope
  label: string
  testID: string
}[] {
  return TASK_STATUS_SCOPES.map((scope) => ({
    value: scope,
    label: TASK_STATUS_SCOPE_LABELS[scope],
    testID: `porcelain-tasks-scope-${scope}`,
  }))
}

/**
 * Partition rows into the scope's status sections.
 *
 * A partition, never a re-sort: `aggregateTaskRows` already put the rows in one total order
 * (newest-updated first, ties broken by Environment then id) and sorting again here would let
 * the board disagree with the table Web draws from the same rows. Empty sections are dropped
 * so a scope with one populated status does not print three empty headings.
 */
export function groupRowsByStatus(
  rows: readonly TaskRow[],
  scope: TaskStatusScope,
): { status: TaskStatus; rows: TaskRow[] }[] {
  return statusesInScope(scope)
    .map((status) => ({ status, rows: rows.filter((row) => row.task.status === status) }))
    .filter((group) => group.rows.length > 0)
}
