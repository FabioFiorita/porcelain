import { TASK_STATUSES, type TaskStatus } from '@porcelain/contracts/tasks'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { compactButtonClass, compactInputClass } from '@renderer/lib/controls'
import { cn } from '@renderer/lib/utils'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { MissingEnvironmentTargetError, useTaskActions } from './tasks-mutations'

/**
 * Quick Add: capture a follow-up without leaving the table.
 *
 * References default from the current Hub selection, because the Task you are filing while
 * looking at a Worktree is almost always about it — but the Environment is a real control,
 * not a default, since a global table must never guess the machine it writes to. With no
 * reachable Environment the form refuses and says so; it does not fail silently and it does
 * not pick one.
 *
 * Attachments are given as absolute host paths and COPIED by the daemon. A browser file
 * picker cannot yield a path (and the daemon, not the browser, is the thing with the disk),
 * so the field is a path — the same input in both runtimes.
 */

const STATUS_LABELS: Readonly<Record<TaskStatus, string>> = {
  todo: 'To do',
  doing: 'Doing',
  done: 'Done',
  blocked: 'Blocked',
}

export type QuickAddProps = {
  readonly environments: readonly { id: string | null; name: string }[]
}

function splitTags(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '')
}

export function TasksQuickAdd({ environments }: QuickAddProps): React.JSX.Element {
  const selection = useHubSelectionStore((s) => s.selection)
  const actions = useTaskActions()

  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [tags, setTags] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [attachment, setAttachment] = useState('')
  const [chosenEnvironment, setChosenEnvironment] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const selectionEnvironment = selection.kind === 'home' ? undefined : selection.environmentId
  // The person's explicit choice wins; then the Hub selection, if that Environment is
  // actually answering; then the only Environment there is. Never an arbitrary first row.
  const resolvedEnvironment: string | null | undefined =
    chosenEnvironment !== undefined
      ? chosenEnvironment
      : environments.some((environment) => environment.id === selectionEnvironment)
        ? selectionEnvironment
        : environments.length === 1
          ? environments[0]?.id
          : undefined

  const references =
    selection.kind === 'home'
      ? {}
      : selection.kind === 'project'
        ? { projectId: selection.projectId }
        : { projectId: selection.projectId, worktreeId: selection.worktreeId }

  const submit = (): void => {
    setError(null)
    const trimmed = title.trim()
    if (trimmed === '') {
      setError('A Task needs a title.')
      return
    }
    const links =
      linkUrl.trim() === ''
        ? undefined
        : [
            {
              url: linkUrl.trim(),
              label: linkLabel.trim() === '' ? linkUrl.trim() : linkLabel.trim(),
            },
          ]
    const attachmentPaths = attachment.trim() === '' ? undefined : [attachment.trim()]

    runUserAction(
      async () => {
        await actions.add(resolvedEnvironment, {
          title: trimmed,
          status,
          ...(splitTags(tags).length > 0 ? { tags: splitTags(tags) } : {}),
          ...(Object.keys(references).length > 0 ? { references } : {}),
          ...(links !== undefined ? { links } : {}),
          ...(attachmentPaths !== undefined ? { attachmentPaths } : {}),
        })
        setTitle('')
        setTags('')
        setLinkUrl('')
        setLinkLabel('')
        setAttachment('')
      },
      (reason: unknown) => {
        // The form owns this failure, not a toast: an unresolvable Environment is a thing
        // the person fixes in the control right next to the message.
        setError(
          reason instanceof MissingEnvironmentTargetError
            ? reason.message
            : reason instanceof Error
              ? reason.message
              : 'Could not create that Task.',
        )
      },
    )
  }

  return (
    <div
      data-testid={TestIds.tasksQuickAdd}
      className="flex flex-col gap-2 border-b bg-card/40 p-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          data-testid={TestIds.tasksQuickAddTitle}
          aria-label="Task title"
          placeholder="Add a Task…"
          className={cn(compactInputClass, 'min-w-56 flex-1')}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
          }}
        />
        <select
          data-testid={TestIds.tasksQuickAddStatus}
          aria-label="Task status"
          className={cn(compactInputClass, 'rounded-md border bg-background px-2')}
          value={status}
          onChange={(event) => setStatus(event.target.value as TaskStatus)}
        >
          {TASK_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <select
          data-testid={TestIds.tasksQuickAddEnvironment}
          aria-label="Environment"
          className={cn(compactInputClass, 'rounded-md border bg-background px-2')}
          value={resolvedEnvironment === undefined ? '' : (resolvedEnvironment ?? 'local')}
          onChange={(event) => {
            const value = event.target.value
            setChosenEnvironment(value === '' ? undefined : value === 'local' ? null : value)
          }}
        >
          <option value="">Choose an Environment…</option>
          {environments.map((environment) => (
            <option key={environment.id ?? 'local'} value={environment.id ?? 'local'}>
              {environment.name}
            </option>
          ))}
        </select>
        <Button
          data-testid={TestIds.tasksQuickAddSubmit}
          className={compactButtonClass}
          disabled={actions.isPending}
          onClick={submit}
        >
          <Plus /> Add
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          data-testid={TestIds.tasksQuickAddTags}
          aria-label="Tags"
          placeholder="tags, comma separated"
          className={cn(compactInputClass, 'w-44')}
          value={tags}
          onChange={(event) => setTags(event.target.value)}
        />
        <Input
          data-testid={TestIds.tasksQuickAddLinkUrl}
          aria-label="Link URL"
          placeholder="https://…"
          className={cn(compactInputClass, 'w-56')}
          value={linkUrl}
          onChange={(event) => setLinkUrl(event.target.value)}
        />
        <Input
          data-testid={TestIds.tasksQuickAddLinkLabel}
          aria-label="Link label"
          placeholder="Link label"
          className={cn(compactInputClass, 'w-40')}
          value={linkLabel}
          onChange={(event) => setLinkLabel(event.target.value)}
        />
        <Input
          data-testid={TestIds.tasksQuickAddAttachment}
          aria-label="Attachment path"
          placeholder="/absolute/path/to/file"
          className={cn(compactInputClass, 'min-w-56 flex-1 font-mono')}
          value={attachment}
          onChange={(event) => setAttachment(event.target.value)}
        />
      </div>
      {error !== null && <p className="px-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}
