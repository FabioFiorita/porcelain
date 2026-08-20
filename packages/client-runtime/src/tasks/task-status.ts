import { TASK_STATUSES, type TaskStatus } from '@porcelain/contracts/tasks'

/**
 * What a Tasks board shows before anyone touches a filter, and what it calls each status.
 *
 * Done Tasks are hidden until asked for. A finished Task is noise on a board about what is
 * left to do, and the human keeps them only long enough to delete them. This is the initial
 * scope, not a stored preference: "hidden by default" has to hold on every load, so showing
 * Done is deliberately a per-session choice rather than something a stored preference can
 * carry into tomorrow.
 *
 * It lives in client-runtime because both clients start from this rule — web opens its
 * multi-select on `OPEN_TASK_STATUSES`, mobile's segmented control opens on the `open` segment
 * that means exactly this set. Each client keeps its own control vocabulary; only the rule and
 * the names are shared, so the two boards cannot quietly disagree about whether Done is
 * visible.
 */

/** Every status but `done`, in `TASK_STATUSES` order. */
export const OPEN_TASK_STATUSES: readonly TaskStatus[] = TASK_STATUSES.filter(
  (status) => status !== 'done',
)

/** What each status is called in front of a person. */
export const TASK_STATUS_LABELS: Readonly<Record<TaskStatus, string>> = {
  todo: 'To do',
  doing: 'Doing',
  done: 'Done',
  blocked: 'Blocked',
}
