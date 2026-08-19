import type { TaskRow } from '@porcelain/client-runtime/tasks'
import {
  availableTaskColumns,
  TASK_COLUMN_LABELS,
  TASK_REQUIRED_COLUMN_IDS,
} from '@porcelain/client-runtime/tasks'
import { TASK_STATUSES, type TaskStatus } from '@porcelain/contracts/tasks'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { Input } from '@renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { useHubInventories } from '@renderer/features/projects'
import { toastingAction } from '@renderer/hooks/mutation-error'
import { compactInputClass } from '@renderer/lib/controls'
import { cn } from '@renderer/lib/utils'
import { TestIds } from '@shared/test-ids'
import { Columns3 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { TaskDetailSheet } from './task-detail-sheet'
import { TaskImageLightbox } from './task-image-lightbox'
import { taskMatchesQuery } from './task-match'
import { useTaskImagePreviews } from './task-previews'
import { useTaskColumnsStore, visibleTaskColumns } from './tasks-columns-store'
import { useTaskActions } from './tasks-mutations'
import { useTasks } from './tasks-queries'
import { TasksTable } from './tasks-table'

const STATUS_LABELS: Readonly<Record<TaskStatus, string>> = {
  todo: 'To do',
  doing: 'Doing',
  done: 'Done',
  blocked: 'Blocked',
}

const STATUS_FILTER_ITEMS = [
  { label: 'All statuses', value: 'all' },
  ...TASK_STATUSES.map((status) => ({ label: STATUS_LABELS[status], value: status })),
]

/**
 * The Tasks Viewer tab: filters, the column picker, and the table itself.
 *
 * Deliberately not scoped to the selected Worktree — coordination outlives any one checkout.
 */
export function TasksView(): React.JSX.Element {
  const { rows, environments, error, isLoaded } = useTasks()
  const inventories = useHubInventories()
  const order = useTaskColumnsStore((s) => s.order)
  const hidden = useTaskColumnsStore((s) => s.hidden)
  const toggle = useTaskColumnsStore((s) => s.toggle)
  const actions = useTaskActions()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<TaskRow | null>(null)
  const [preview, setPreview] = useState<{ src: string; name: string } | null>(null)

  // The Environment column only exists where several Environments answer at once — the Mac app
  // and mobile fan out, a browser client is served by one daemon. Gating on the reachable
  // Environments rather than the runtime keeps a single-Environment Hub from printing the same
  // name on every row, and keeps the column out of the picker where it can never mean anything.
  const columns = useMemo(
    () => availableTaskColumns(environments.length > 1),
    [environments.length],
  )
  const visible = visibleTaskColumns(order, hidden).filter((column) => columns.includes(column))
  const projectNames = useMemo(() => {
    const names: Record<string, string> = {}
    for (const source of inventories) {
      for (const project of source.inventory.projects) names[project.id] = project.name
    }
    return names
  }, [inventories])
  const projectOptions = useMemo(() => {
    const seen = new Set<string>()
    const options: { id: string; name: string }[] = []
    for (const row of rows) {
      const id = row.task.references.projectId
      if (id === undefined || seen.has(id)) continue
      seen.add(id)
      options.push({ id, name: projectNames[id] ?? id })
    }
    return options
  }, [projectNames, rows])
  const projectFilterItems = useMemo(
    () => [
      { label: 'All projects', value: 'all' },
      ...projectOptions.map((project) => ({ label: project.name, value: project.id })),
    ],
    [projectOptions],
  )
  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        if (statusFilter !== 'all' && row.task.status !== statusFilter) return false
        if (projectFilter !== 'all' && row.task.references.projectId !== projectFilter) return false
        return taskMatchesQuery(row, query, projectNames)
      }),
    [projectFilter, projectNames, query, rows, statusFilter],
  )
  const imagePreviews = useTaskImagePreviews(filtered)
  const openRow = rows.find((row) => row.task.id === openId) ?? null
  const knownTags = useMemo(() => [...new Set(rows.flatMap((row) => row.task.tags))], [rows])

  const changeStatus = (row: TaskRow, status: TaskStatus): void => {
    toastingAction('Update Task', () =>
      actions.update(row.environmentId, { taskId: row.task.id, status }),
    )()
  }

  const confirmDelete = (): void => {
    if (pendingDelete === null) return
    const row = pendingDelete
    setPendingDelete(null)
    if (openId === row.task.id) setOpenId(null)
    toastingAction('Delete Task', () => actions.remove(row.environmentId, row.task.id))()
  }

  return (
    <div data-testid={TestIds.tasksView} className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-2 py-1.5">
        <Input
          data-testid={TestIds.tasksFilter}
          aria-label="Filter tasks"
          placeholder="Filter by anything…"
          className={cn(compactInputClass, 'min-w-40 flex-1')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          items={STATUS_FILTER_ITEMS}
          value={statusFilter}
          onValueChange={(next: string | null) => setStatusFilter(next ?? 'all')}
        >
          <SelectTrigger
            data-testid={TestIds.tasksFilterStatus}
            aria-label="Filter by status"
            size="sm"
            className="min-w-32"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All statuses</SelectItem>
              {TASK_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          items={projectFilterItems}
          value={projectFilter}
          onValueChange={(next: string | null) => setProjectFilter(next ?? 'all')}
        >
          <SelectTrigger
            data-testid={TestIds.tasksFilterProject}
            aria-label="Filter by project"
            size="sm"
            className="min-w-32"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All projects</SelectItem>
              {projectOptions.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <span className="ml-auto text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
          {filtered.length} Task{filtered.length === 1 ? '' : 's'}
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
            <DropdownMenuGroup>
              <DropdownMenuLabel>Columns</DropdownMenuLabel>
              {columns.map((column) => (
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
            No Tasks yet. Press ⌘⇧N or the plus on Tasks to add one.
          </p>
        )}
        {error === null && rows.length > 0 && (
          <TasksTable
            rows={filtered}
            visibleColumns={visible}
            projectNames={projectNames}
            imagePreviews={imagePreviews}
            onStatusChange={changeStatus}
            onAskDelete={setPendingDelete}
            onOpen={(row) => setOpenId(row.task.id)}
            onPreviewImage={setPreview}
          />
        )}
      </div>
      <TaskDetailSheet row={openRow} onClose={() => setOpenId(null)} knownTags={knownTags} />
      <TaskImageLightbox image={preview} onClose={() => setPreview(null)} />
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.task.shortId}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {pendingDelete?.task.title} from the board. Pictures copied onto it are
              discarded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              data-testid={TestIds.tasksDeleteConfirm}
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
