import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { compactButtonClass } from '@renderer/lib/controls'
import { useNewTaskDialogStore } from '@renderer/stores/new-task-dialog'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { useState } from 'react'
import {
  composerTags,
  emptyComposerValue,
  TaskComposer,
  type TaskComposerValue,
} from './task-composer'
import {
  MissingEnvironmentTargetError,
  type TaskEnvironmentTarget,
  useTaskActions,
} from './tasks-mutations'
import { useTasks } from './tasks-queries'

/**
 * `null` is a real Environment target (This device — the directly connected daemon), so the
 * picker cannot use the id as its value: it needs one that is never confusable with "unchosen".
 */
function environmentValue(id: string | null): string {
  return id ?? 'this-device'
}

/**
 * New-task composer: title, notes, a Project, pasted/uploaded pictures, and @ file/folder tags.
 */
export function NewTaskDialog(): React.JSX.Element {
  const open = useNewTaskDialogStore((s) => s.open)
  const hide = useNewTaskDialogStore((s) => s.hide)
  const { environments, rows } = useTasks()
  const knownTags = [...new Set(rows.flatMap((row) => row.task.tags))]
  const actions = useTaskActions()
  const [draft, setDraft] = useState<TaskComposerValue>(emptyComposerValue)
  const [error, setError] = useState<string | null>(null)
  /** The picker's VALUE, not an Environment id: `null` means nobody has chosen yet. */
  const [chosenValue, setChosenValue] = useState<string | null>(null)

  /**
   * A Hub reaching several Environments has no "current" daemon to fall back on, so the person
   * names the target and an unchosen one is refused (`MissingEnvironmentTargetError`) rather than
   * guessed — guessing is how a Task gets filed on the wrong machine. With one Environment there
   * is nothing to choose, so no control appears.
   */
  const multiEnvironment = environments.length > 1
  const chosen = environments.find(
    (environment) => environmentValue(environment.id) === chosenValue,
  )
  const targetEnvironment: TaskEnvironmentTarget = multiEnvironment
    ? chosen === undefined
      ? undefined
      : chosen.id
    : (environments[0]?.id ?? null)

  const reset = (): void => {
    setDraft(emptyComposerValue())
    setError(null)
    setChosenValue(null)
  }

  const submit = (): void => {
    setError(null)
    const title = draft.title.trim()
    if (title === '') {
      setError('A Task needs a title.')
      return
    }
    runUserAction(
      async () => {
        await actions.add(targetEnvironment, {
          title,
          ...(draft.notes.trim() !== '' ? { notes: draft.notes.trim() } : {}),
          ...(draft.projectId !== null
            ? {
                references:
                  draft.worktreeId === null
                    ? { projectId: draft.projectId }
                    : { projectId: draft.projectId, worktreeId: draft.worktreeId },
              }
            : {}),
          ...(draft.pathRefs.length > 0 ? { pathRefs: draft.pathRefs } : {}),
          ...(composerTags(draft).length > 0 ? { tags: composerTags(draft) } : {}),
          ...(draft.links.length > 0 ? { links: draft.links } : {}),
          ...(draft.uploads.length > 0
            ? {
                attachmentUploads: draft.uploads.map((upload) => ({
                  name: upload.name,
                  contentBase64: upload.contentBase64,
                })),
              }
            : {}),
        })
        reset()
        hide()
      },
      (reason: unknown) => {
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
    <Dialog
      open={open}
      onOpenChange={(next: boolean): void => {
        if (!next) {
          reset()
          hide()
        }
      }}
    >
      <DialogContent data-testid={TestIds.tasksDialog} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
          <DialogDescription>
            {multiEnvironment
              ? 'Add a Task to one Environment’s board.'
              : 'Add a Task to this daemon’s board.'}
          </DialogDescription>
        </DialogHeader>
        {multiEnvironment && (
          <Select
            items={environments.map((environment) => ({
              label: environment.name,
              value: environmentValue(environment.id),
            }))}
            value={chosenValue}
            onValueChange={(next: string | null) => setChosenValue(next)}
          >
            <SelectTrigger
              data-testid={TestIds.tasksComposerEnvironment}
              aria-label="Environment"
              className="w-full"
            >
              <SelectValue placeholder="Choose an Environment" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {environments.map((environment) => (
                  <SelectItem
                    key={environmentValue(environment.id)}
                    value={environmentValue(environment.id)}
                  >
                    {environment.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
        <TaskComposer value={draft} onChange={setDraft} knownTags={knownTags} />
        {error !== null && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            data-testid={TestIds.tasksComposerSubmit}
            className={compactButtonClass}
            disabled={actions.isPending}
            onClick={submit}
          >
            Create task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
