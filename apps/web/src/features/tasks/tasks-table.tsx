import type { TaskRow } from '@porcelain/client-runtime/tasks'
import { TASK_COLUMN_LABELS, type TaskColumnId } from '@porcelain/client-runtime/tasks'
import { TASK_STATUSES, type TaskStatus } from '@porcelain/contracts/tasks'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@renderer/components/ui/table'
import { cn } from '@renderer/lib/utils'
import { TestIds } from '@shared/test-ids'
import {
  columnVisibilityFeature,
  createColumnHelper,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { Link2, Paperclip, Trash2 } from 'lucide-react'
import { useMemo } from 'react'

/**
 * The Tasks table.
 *
 * Built on TanStack Table v9 with only the column-visibility feature registered — the
 * columns are configurable, everything else (filters, pagination, selection) is out of scope
 * for this slice and registering an unused feature would ship state nobody reads.
 *
 * Every row knows the Environment it came from, and every control on it passes that
 * Environment back to the caller. There is no "current" Environment in this component.
 */

const features = tableFeatures({ columnVisibilityFeature })
const helper = createColumnHelper<typeof features, TaskRow>()

const STATUS_LABELS: Readonly<Record<TaskStatus, string>> = {
  todo: 'To do',
  doing: 'Doing',
  done: 'Done',
  blocked: 'Blocked',
}

const STATUS_TONE: Readonly<Record<TaskStatus, string>> = {
  todo: 'bg-muted text-muted-foreground',
  doing: 'bg-primary/15 text-primary',
  done: 'bg-emerald-500/15 text-emerald-500',
  blocked: 'bg-destructive/15 text-destructive',
}

function shortId(value: string | undefined): string {
  if (value === undefined || value === '') return '—'
  return value.length <= 12 ? value : `${value.slice(0, 12)}…`
}

function formatUpdated(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export type TasksTableProps = {
  readonly rows: readonly TaskRow[]
  readonly visibleColumns: readonly TaskColumnId[]
  readonly onStatusChange: (row: TaskRow, status: TaskStatus) => void
  readonly onDelete: (row: TaskRow) => void
}

function StatusCell({
  row,
  onStatusChange,
}: {
  row: TaskRow
  onStatusChange: TasksTableProps['onStatusChange']
}): React.JSX.Element {
  return (
    <select
      data-testid={TestIds.tasksRowStatus(row.task.id)}
      aria-label={`Status of ${row.task.title}`}
      className={cn(
        'h-6 rounded-md border-0 px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        STATUS_TONE[row.task.status],
      )}
      value={row.task.status}
      onChange={(event) => onStatusChange(row, event.target.value as TaskStatus)}
    >
      {TASK_STATUSES.map((status) => (
        <option key={status} value={status}>
          {STATUS_LABELS[status]}
        </option>
      ))}
    </select>
  )
}

function TitleCell({ row }: { row: TaskRow }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-sm text-foreground">{row.task.title}</span>
      <div className="flex items-center gap-2 text-2xs text-muted-foreground">
        {row.task.attachments.length > 0 && (
          <span className="flex items-center gap-1">
            <Paperclip className="size-3" />
            {row.task.attachments.map((attachment) => attachment.name).join(', ')}
          </span>
        )}
        {row.task.links.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 underline-offset-2 hover:underline"
          >
            <Link2 className="size-3" />
            {link.label}
          </a>
        ))}
      </div>
    </div>
  )
}

function buildColumns(props: TasksTableProps) {
  return helper.columns([
    helper.display({
      id: 'status',
      header: TASK_COLUMN_LABELS.status,
      cell: (context) => (
        <StatusCell row={context.row.original} onStatusChange={props.onStatusChange} />
      ),
    }),
    helper.display({
      id: 'title',
      header: TASK_COLUMN_LABELS.title,
      cell: (context) => <TitleCell row={context.row.original} />,
    }),
    helper.display({
      id: 'tags',
      header: TASK_COLUMN_LABELS.tags,
      cell: (context) => (
        <div className="flex flex-wrap gap-1">
          {context.row.original.task.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      ),
    }),
    helper.display({
      id: 'project',
      header: TASK_COLUMN_LABELS.project,
      cell: (context) => (
        <span className="text-xs text-muted-foreground">
          {shortId(context.row.original.task.references.projectId)}
        </span>
      ),
    }),
    helper.display({
      id: 'environment',
      header: TASK_COLUMN_LABELS.environment,
      cell: (context) => (
        <span className="text-xs text-muted-foreground">
          {context.row.original.environmentName}
        </span>
      ),
    }),
    helper.display({
      id: 'worktree',
      header: TASK_COLUMN_LABELS.worktree,
      cell: (context) => (
        <span className="text-xs text-muted-foreground">
          {shortId(context.row.original.task.references.worktreeId)}
        </span>
      ),
    }),
    helper.display({
      id: 'updated',
      header: TASK_COLUMN_LABELS.updated,
      cell: (context) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatUpdated(context.row.original.task.updatedAt)}
        </span>
      ),
    }),
    helper.display({
      id: 'actions',
      header: '',
      cell: (context) => (
        <Button
          variant="ghost"
          size="icon-xs"
          data-testid={TestIds.tasksRowDelete(context.row.original.task.id)}
          aria-label={`Delete ${context.row.original.task.title}`}
          onClick={() => props.onDelete(context.row.original)}
        >
          <Trash2 />
        </Button>
      ),
    }),
  ])
}

export function TasksTable(props: TasksTableProps): React.JSX.Element {
  const columns = useMemo(() => buildColumns(props), [props])
  const columnVisibility = useMemo(() => {
    const visible = new Set<string>([...props.visibleColumns, 'actions'])
    return Object.fromEntries(
      columns.map((column) => [column.id ?? '', visible.has(column.id ?? '')]),
    )
  }, [columns, props.visibleColumns])

  const table = useTable({
    features,
    columns,
    data: props.rows as TaskRow[],
    state: { columnVisibility },
    getRowId: (row) => `${row.environmentId ?? 'local'}:${row.task.id}`,
  })

  return (
    <Table data-testid={TestIds.tasksTable}>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder ? null : <table.FlexRender header={header} />}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id} data-testid={TestIds.tasksRow(row.original.task.id)}>
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                <table.FlexRender cell={cell} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
