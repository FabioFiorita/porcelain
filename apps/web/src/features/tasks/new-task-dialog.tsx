import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { compactButtonClass, compactInputClass } from '@renderer/lib/controls'
import { cn } from '@renderer/lib/utils'
import { useNewTaskDialogStore } from '@renderer/stores/new-task-dialog'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { useState } from 'react'
import { MissingEnvironmentTargetError, useTaskActions } from './tasks-mutations'
import { useTasks } from './tasks-queries'

function ComingSoon({ field, label }: { field: string; label: string }): React.JSX.Element {
  return (
    <div
      data-testid={TestIds.tasksComingSoon(field)}
      className="flex items-center justify-between gap-2 rounded-md border border-dashed px-2 py-1.5"
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <Badge variant="secondary" className="text-2xs">
        Coming soon
      </Badge>
    </div>
  )
}

/**
 * New-task dialog: title creates a Task today. Pictures, file/folder tags, and
 * project/worktree tags are shown as coming-soon until that slice ships.
 */
export function NewTaskDialog(): React.JSX.Element {
  const open = useNewTaskDialogStore((s) => s.open)
  const hide = useNewTaskDialogStore((s) => s.hide)
  const { environments } = useTasks()
  const actions = useTaskActions()
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Browser tab = the serving daemon (`null`). One listed Environment uses that id.
  // Several Environments still write to the bound daemon until project/worktree tags ship.
  const targetEnvironment = environments.length === 1 ? environments[0]?.id : null

  const reset = (): void => {
    setTitle('')
    setError(null)
  }

  const submit = (): void => {
    setError(null)
    const trimmed = title.trim()
    if (trimmed === '') {
      setError('A Task needs a title.')
      return
    }
    runUserAction(
      async () => {
        await actions.add(targetEnvironment, { title: trimmed })
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
      <DialogContent data-testid={TestIds.tasksDialog} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
          <DialogDescription>Add a Task to this daemon’s board.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Input
            data-testid={TestIds.tasksQuickAddTitle}
            aria-label="Task title"
            placeholder="Task title"
            className={cn(compactInputClass, 'w-full')}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
            }}
          />
          <ComingSoon field="pictures" label="Pictures" />
          <ComingSoon field="files" label="Files and folders" />
          <ComingSoon field="worktree" label="Project and worktree tags" />
          {error !== null && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            data-testid={TestIds.tasksQuickAddSubmit}
            className={compactButtonClass}
            disabled={actions.isPending}
            onClick={submit}
          >
            Add Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
