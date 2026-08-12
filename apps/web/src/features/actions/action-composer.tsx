import type { Action, ActionWhere } from '@porcelain/contracts/actions'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Textarea } from '@renderer/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { kbdLabel } from '@renderer/lib/keyboard'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { Cloud, Monitor } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useActionMutations } from './actions-mutations'

export interface ActionDraft {
  /** Present when editing an existing action; absent when creating one. */
  id?: string
  title: string
  command: string
  where: ActionWhere
}

/** Build an edit draft from an existing action. */
export function draftFromAction(action: Action): ActionDraft {
  return {
    id: action.id,
    title: action.title,
    command: action.command,
    where: action.where === 'local' ? 'local' : 'primary',
  }
}

/** Controlled dialog to create or edit a saved action (title + command + optional where). */
export function ActionComposer({
  draft,
  open,
  onOpenChange,
  /** When true (remote-bound Electron window), show the primary / This device toggle. */
  showWhere,
}: {
  draft: ActionDraft | null
  open: boolean
  onOpenChange: (open: boolean) => void
  showWhere: boolean
}): React.JSX.Element {
  const { add, update } = useActionMutations()
  const [title, setTitle] = useState('')
  const [command, setCommand] = useState('')
  const [where, setWhere] = useState<ActionWhere>('primary')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && draft) {
      setTitle(draft.title)
      setCommand(draft.command)
      setWhere(draft.where)
    }
  }, [open, draft])

  const handleSave = (): void => {
    if (!draft || title.trim() === '' || command.trim() === '' || saving) return
    setSaving(true)
    runUserAction(
      async () => {
        // Always send where on edit so switching back to primary clears a stored local.
        const payload = {
          title: title.trim(),
          command: command.trim(),
          where: showWhere ? where : 'primary',
        }
        if (draft.id) {
          await update(draft.id, payload)
        } else {
          await add(payload)
        }
        onOpenChange(false)
      },
      (error) => {
        toastUserActionError(draft.id ? 'Update action' : 'Add action', error)
      },
      () => {
        setSaving(false)
      },
    )
  }

  // ⌘↵ and ⌘S both save, from any field.
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'Enter' || e.key.toLowerCase() === 's')) {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{draft?.id ? 'Edit action' : 'New action'}</DialogTitle>
        </DialogHeader>
        <Input
          value={title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Title (e.g. Run Tests)"
          aria-label="Action title"
          data-testid={TestIds.actionTitleInput}
          className="rounded-md"
        />
        <Textarea
          value={command}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>): void => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Command — runs in a terminal. ${kbdLabel('mod', '↵')} to save`}
          aria-label="Action command"
          data-testid={TestIds.actionCommandInput}
          rows={3}
          className="resize-none font-mono text-xs"
        />
        {showWhere && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Run on</span>
            <ToggleGroup
              value={[where]}
              onValueChange={(value: string[]) => {
                const next = value[0]
                if (next === 'primary' || next === 'local') setWhere(next)
              }}
              data-testid={TestIds.actionWhere}
              className="justify-start"
            >
              <ToggleGroupItem value="primary" size="sm" aria-label="Run on this window’s machine">
                <Cloud className="size-3.5" />
                This window’s machine
              </ToggleGroupItem>
              <ToggleGroupItem value="local" size="sm" aria-label="Run on this device">
                <Monitor className="size-3.5" />
                This device
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={title.trim() === '' || command.trim() === '' || saving}
            data-testid={TestIds.actionSave}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : draft?.id ? 'Save' : 'Add action'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
