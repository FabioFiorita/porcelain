import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
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
import { MissingEnvironmentTargetError, useTaskActions } from './tasks-mutations'
import { useTasks } from './tasks-queries'

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

  const targetEnvironment = environments.length === 1 ? environments[0]?.id : null

  const reset = (): void => {
    setDraft(emptyComposerValue())
    setError(null)
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
          <DialogDescription>Add a Task to this daemon’s board.</DialogDescription>
        </DialogHeader>
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
