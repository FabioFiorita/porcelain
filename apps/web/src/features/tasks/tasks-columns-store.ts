import {
  DEFAULT_HIDDEN_TASK_COLUMN_IDS,
  DEFAULT_TASK_COLUMN_ORDER,
  resolveHiddenTaskColumns,
  resolveTaskColumnOrder,
  TASK_REQUIRED_COLUMN_IDS,
  type TaskColumnId,
} from '@porcelain/client-runtime/tasks'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Which Tasks columns this person wants to see, and in what order.
 *
 * PERSONAL presentation state: persisted in `localStorage` and never written to a daemon or
 * a repository. Two people looking at the same Environment's Tasks may reasonably want
 * different columns, and neither choice belongs in Git (issue #18: personal UI state stays
 * client-local).
 *
 * Persisted values are reconciled against the current column vocabulary on read, so a build
 * that adds or removes a column cannot be poisoned by an old `localStorage` entry.
 */

interface TaskColumnsStore {
  order: TaskColumnId[]
  hidden: TaskColumnId[]
  toggle: (id: TaskColumnId) => void
  reset: () => void
}

export const useTaskColumnsStore = create<TaskColumnsStore>()(
  persist(
    (set) => ({
      order: [...DEFAULT_TASK_COLUMN_ORDER],
      hidden: [...DEFAULT_HIDDEN_TASK_COLUMN_IDS],
      toggle: (id) =>
        set((state) => {
          if (TASK_REQUIRED_COLUMN_IDS.includes(id)) return state
          const hidden = state.hidden.includes(id)
            ? state.hidden.filter((entry) => entry !== id)
            : [...state.hidden, id]
          return { hidden }
        }),
      reset: () =>
        set({
          order: [...DEFAULT_TASK_COLUMN_ORDER],
          hidden: [...DEFAULT_HIDDEN_TASK_COLUMN_IDS],
        }),
    }),
    {
      name: 'porcelain-task-columns',
      merge: (persisted, current) => {
        const stored = persisted as Partial<{ order: string[]; hidden: string[] }> | undefined
        return {
          ...current,
          order: resolveTaskColumnOrder(stored?.order ?? [...DEFAULT_TASK_COLUMN_ORDER]),
          hidden: resolveHiddenTaskColumns(stored?.hidden ?? [...DEFAULT_HIDDEN_TASK_COLUMN_IDS]),
        }
      },
    },
  ),
)

/** The visible columns, in the persisted order. */
export function visibleTaskColumns(
  order: readonly TaskColumnId[],
  hidden: readonly TaskColumnId[],
) {
  return order.filter((id) => !hidden.includes(id))
}
