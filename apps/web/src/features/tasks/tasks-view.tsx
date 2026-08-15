import type { TaskRow } from '@porcelain/client-runtime/tasks'
import {
  TASK_COLUMN_IDS,
  TASK_COLUMN_LABELS,
  TASK_REQUIRED_COLUMN_IDS,
} from '@porcelain/client-runtime/tasks'
import type { TaskStatus } from '@porcelain/contracts/tasks'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { toastingAction } from '@renderer/hooks/mutation-error'
import { TestIds } from '@shared/test-ids'
import { Columns3 } from 'lucide-react'
import { useTaskColumnsStore, visibleTaskColumns } from './tasks-columns-store'
import { useTaskActions } from './tasks-mutations'
import { useTasks } from './tasks-queries'
import { TasksQuickAdd } from './tasks-quick-add'
import { TasksTable } from './tasks-table'

/**
 * The Tasks Viewer tab: Quick Add, the column picker, and the table itself.
 *
 * This is the one surface that is deliberately NOT scoped to the selected Worktree — the
 * whole point of moving off the per-repository Board is that coordination outlives any one
 * checkout (issue #23, story 36).
 */
export function TasksView(): React.JSX.Element {
  const { rows, environments, error, isLoaded } = useTasks()
  const order = useTaskColumnsStore((s) => s.order)
  const hidden = useTaskColumnsStore((s) => s.hidden)
  const toggle = useTaskColumnsStore((s) => s.toggle)
  const actions = useTaskActions()

  const visible = visibleTaskColumns(order, hidden)

  const changeStatus = (row: TaskRow, status: TaskStatus): void => {
    toastingAction('Update Task', () =>
      actions.update(row.environmentId, { taskId: row.task.id, status }),
    )()
  }

  const remove = (row: TaskRow): void => {
    toastingAction('Delete Task', () => actions.remove(row.environmentId, row.task.id))()
  }

  return (
    <div data-testid={TestIds.tasksView} className="flex h-full min-h-0 flex-col">
      <TasksQuickAdd environments={environments} />
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
          {rows.length} Task{rows.length === 1 ? '' : 's'}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                data-testid={TestIds.tasksColumnsMenu}
                aria-label="Choose columns"
                className="flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Columns3 className="size-3.5" />
                Columns
              </button>
            }
          />
          <DropdownMenuContent align="end">
            {/* Base UI requires a GroupLabel to sit inside its Group. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel>Columns</DropdownMenuLabel>
              {TASK_COLUMN_IDS.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column}
                  data-testid={TestIds.tasksColumnToggle(column)}
                  closeOnClick={false}
                  checked={!hidden.includes(column)}
                  disabled={TASK_REQUIRED_COLUMN_IDS.includes(column)}
                  onCheckedChange={() => toggle(column)}
                >
                  {TASK_COLUMN_LABELS[column]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {error !== null && (
          <p data-testid={TestIds.tasksError} className="p-4 text-sm text-destructive">
            Couldn't load Tasks. {error}
          </p>
        )}
        {error === null && isLoaded && rows.length === 0 && (
          <p data-testid={TestIds.tasksEmpty} className="p-4 text-sm text-muted-foreground">
            No Tasks yet. Add one above — it lives on the Environment, not in a repository.
          </p>
        )}
        {error === null && rows.length > 0 && (
          <TasksTable
            rows={rows}
            visibleColumns={visible}
            onStatusChange={changeStatus}
            onDelete={remove}
          />
        )}
      </div>
    </div>
  )
}
