import { SidebarHeaderActions } from '@renderer/components/shell/sidebar-header-actions'
import { Button } from '@renderer/components/ui/button'
import { targetedTab } from '@renderer/stores/hub-tabs'
import { useTabsStore } from '@renderer/stores/tabs'
import { TestIds } from '@shared/test-ids'
import { Table2 } from 'lucide-react'
import { useTasks } from './tasks-queries'

/**
 * The Tasks sidebar panel: a compact read of the same rows the Viewer table shows, plus the
 * way into it. Mirrors the Board and Review panels (list here, full surface in the Viewer).
 *
 * The tab it opens carries NO Hub target on purpose — the table spans every Environment, so
 * binding it to a Worktree would be a lie the tab bar then repeats.
 */
export function TasksList(): React.JSX.Element {
  const { rows, error, isLoaded } = useTasks()
  const openTab = useTabsStore((s) => s.openTab)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end px-2">
        <SidebarHeaderActions>
          <Button
            variant="ghost"
            size="icon-sm"
            data-testid={TestIds.tasksOpen}
            aria-label="Open Tasks"
            onClick={() => openTab(targetedTab('tasks', 'tasks', { title: 'Tasks' }, null))}
          >
            <Table2 />
          </Button>
        </SidebarHeaderActions>
      </div>
      {error !== null && (
        <p className="px-3 py-2 text-xs break-words text-destructive">
          Couldn't load Tasks. {error}
        </p>
      )}
      {error === null && isLoaded && rows.length === 0 && (
        <p className="px-3 py-2 text-xs text-muted-foreground">No Tasks yet.</p>
      )}
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li
            key={`${row.environmentId ?? 'local'}:${row.task.id}`}
            data-testid={TestIds.tasksListRow(row.task.id)}
            className="flex flex-col gap-0.5 px-3 py-1.5 hover:bg-accent/40"
          >
            <span className="truncate text-xs text-foreground">{row.task.title}</span>
            <span className="text-2xs text-muted-foreground">
              {row.task.status} · {row.environmentName}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
