import type { TaskRow } from '@porcelain/client-runtime/tasks'
import { TASK_COLUMN_LABELS, type TaskColumnId } from '@porcelain/client-runtime/tasks'
import { TASK_STATUSES, type TaskStatus } from '@porcelain/contracts/tasks'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@renderer/components/ui/table'
import { toastingAction } from '@renderer/hooks/mutation-error'
import { cn, copyText } from '@renderer/lib/utils'
import { TestIds } from '@shared/test-ids'
import {
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  type SortingState,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { ArrowUpDown, Copy, Folder, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

const features = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
})
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

function formatWhen(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export type TasksTableProps = {
  readonly rows: readonly TaskRow[]
  readonly visibleColumns: readonly TaskColumnId[]
  readonly projectNames: Readonly<Record<string, string>>
  readonly imagePreviews: Readonly<Record<string, string | undefined>>
  readonly onStatusChange: (row: TaskRow, status: TaskStatus) => void
  readonly onAskDelete: (row: TaskRow) => void
  readonly onOpen: (row: TaskRow) => void
  readonly onPreviewImage: (image: { src: string; name: string }) => void
}

function SortHeader({ label, onClick }: { label: string; onClick: () => void }): React.JSX.Element {
  return (
    <Button variant="ghost" className="-ml-2 h-7 px-2 text-xs" onClick={onClick}>
      {label}
      <ArrowUpDown className="size-3" />
    </Button>
  )
}

function buildColumns(props: TasksTableProps) {
  return helper.columns([
    helper.accessor((row) => row.task.shortId, {
      id: 'id',
      header: ({ column }) => (
        <SortHeader label={TASK_COLUMN_LABELS.id} onClick={() => column.toggleSorting()} />
      ),
      cell: (context) => (
        <span className="font-mono text-xs text-muted-foreground">{context.getValue()}</span>
      ),
      sortFn: 'alphanumeric',
    }),
    helper.accessor((row) => row.task.status, {
      id: 'status',
      header: TASK_COLUMN_LABELS.status,
      cell: (context) => {
        const row = context.row.original
        return (
          <Select
            items={TASK_STATUSES.map((status) => ({
              label: STATUS_LABELS[status],
              value: status,
            }))}
            value={row.task.status}
            onValueChange={(next: TaskStatus | null) => {
              if (next === null) return
              props.onStatusChange(row, next)
            }}
          >
            <SelectTrigger
              data-testid={TestIds.tasksRowStatus(row.task.id)}
              aria-label={`Status of ${row.task.title}`}
              size="sm"
              className={cn(
                'h-6 min-w-22 border-0 px-2 text-xs font-medium',
                STATUS_TONE[row.task.status],
              )}
              onClick={(event) => event.stopPropagation()}
            >
              <SelectValue />
            </SelectTrigger>
            {/* The popup is portaled out of the row, but a React-tree click still bubbles to
                the row's own handler — without this, picking a status also opens the sheet. */}
            <SelectContent onClick={(event) => event.stopPropagation()}>
              <SelectGroup>
                {TASK_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )
      },
    }),
    helper.accessor((row) => row.task.title, {
      id: 'title',
      header: ({ column }) => (
        <SortHeader label={TASK_COLUMN_LABELS.title} onClick={() => column.toggleSorting()} />
      ),
      cell: (context) => {
        const row = context.row.original
        const preview = props.imagePreviews[row.task.id]
        return (
          <div className="flex min-w-0 items-center gap-2">
            {preview !== undefined && (
              <button
                type="button"
                className="shrink-0"
                aria-label={`Preview image for ${row.task.title}`}
                onClick={(event) => {
                  event.stopPropagation()
                  props.onPreviewImage({ src: preview, name: row.task.title })
                }}
              >
                <img src={preview} alt="" className="size-8 rounded object-cover" />
              </button>
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm text-foreground">{row.task.title}</span>
              {row.task.pathRefs.length > 0 && (
                <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                  <Folder className="size-3" />
                  {row.task.pathRefs.map((ref) => ref.path).join(', ')}
                </span>
              )}
            </div>
          </div>
        )
      },
      sortFn: 'text',
    }),
    helper.accessor((row) => row.task.references.projectId ?? '', {
      id: 'project',
      header: TASK_COLUMN_LABELS.project,
      cell: (context) => {
        const projectId = context.getValue()
        if (projectId === '') return <span className="text-xs text-muted-foreground">—</span>
        return (
          <span className="text-xs text-muted-foreground">
            {props.projectNames[projectId] ?? projectId}
          </span>
        )
      },
    }),
    helper.accessor((row) => row.environmentName, {
      id: 'environment',
      header: ({ column }) => (
        <SortHeader label={TASK_COLUMN_LABELS.environment} onClick={() => column.toggleSorting()} />
      ),
      // Short ids are per daemon: two Environments can both own a `T-1`. The name is what
      // tells those rows apart, so it is rendered as a badge rather than muted metadata.
      cell: (context) => (
        <Badge variant="outline" className="max-w-40 truncate">
          {context.getValue()}
        </Badge>
      ),
      sortFn: 'text',
    }),
    helper.accessor((row) => row.task.links.map((link) => link.label).join(', '), {
      id: 'links',
      header: TASK_COLUMN_LABELS.links,
      cell: (context) => {
        const links = context.row.original.task.links
        if (links.length === 0) return <span className="text-xs text-muted-foreground">—</span>
        return (
          <div className="flex min-w-0 flex-col gap-0.5">
            {links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="truncate text-xs text-primary hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {link.label}
              </a>
            ))}
          </div>
        )
      },
    }),
    helper.accessor((row) => row.task.updatedAt, {
      id: 'updated',
      header: ({ column }) => (
        <SortHeader label={TASK_COLUMN_LABELS.updated} onClick={() => column.toggleSorting()} />
      ),
      cell: (context) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatWhen(context.getValue())}
        </span>
      ),
    }),
    helper.accessor((row) => row.task.tags.join(', '), {
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
    helper.accessor((row) => row.task.references.worktreeId ?? '', {
      id: 'worktree',
      header: TASK_COLUMN_LABELS.worktree,
      cell: (context) => (
        <span className="text-xs text-muted-foreground">{context.getValue() || '—'}</span>
      ),
    }),
    helper.accessor((row) => row.task.createdAt, {
      id: 'created',
      header: TASK_COLUMN_LABELS.created,
      cell: (context) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatWhen(context.getValue())}
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
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={(event) => {
            event.stopPropagation()
            props.onAskDelete(context.row.original)
          }}
        >
          <Trash2 />
        </Button>
      ),
    }),
  ])
}

function RowMenu({
  row,
  cells,
  onOpen,
  onAskDelete,
}: {
  row: TaskRow
  cells: React.ReactNode
  onOpen: (row: TaskRow) => void
  onAskDelete: (row: TaskRow) => void
}): React.JSX.Element {
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <TableRow
            data-testid={TestIds.tasksRow(row.task.id)}
            className="cursor-pointer"
            onClick={() => onOpen(row)}
          />
        }
      >
        {cells}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={() => onOpen(row)}>Open</ContextMenuItem>
        <ContextMenuItem
          onClick={() => toastingAction('Copy ID', () => copyText(row.task.shortId))()}
        >
          <Copy /> Copy ID
        </ContextMenuItem>
        <ContextMenuItem onClick={() => toastingAction('Copy UUID', () => copyText(row.task.id))()}>
          <Copy /> Copy UUID
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => toastingAction('Copy title', () => copyText(row.task.title))()}
        >
          <Copy /> Copy title
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={() => onAskDelete(row)}>
          <Trash2 /> Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function TasksTable(props: TasksTableProps): React.JSX.Element {
  const columns = useMemo(() => buildColumns(props), [props])
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updated', desc: true }])
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
    state: { columnVisibility, sorting },
    onSortingChange: setSorting,
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
          <RowMenu
            key={row.id}
            row={row.original}
            onOpen={props.onOpen}
            onAskDelete={props.onAskDelete}
            cells={row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                <table.FlexRender cell={cell} />
              </TableCell>
            ))}
          />
        ))}
      </TableBody>
    </Table>
  )
}
