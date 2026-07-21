import type { Action } from '@backend/actions-store'
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
import { useActionMutations } from '@renderer/hooks/use-actions'
import { kbdLabel } from '@renderer/lib/keyboard'
import { TestIds } from '@shared/test-ids'
import { useEffect, useState } from 'react'

export interface ActionDraft {
  /** Present when editing an existing action; absent when creating one. */
  id?: string
  title: string
  command: string
  cwd: string
}

/** Build an edit draft from an existing action. */
export function draftFromAction(action: Action): ActionDraft {
  return { id: action.id, title: action.title, command: action.command, cwd: action.cwd ?? '' }
}

/** Controlled dialog to create or edit a saved action (title + command + optional cwd). */
export function ActionComposer({
  draft,
  open,
  onOpenChange,
}: {
  draft: ActionDraft | null
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const { add, update } = useActionMutations()
  const [title, setTitle] = useState('')
  const [command, setCommand] = useState('')
  const [cwd, setCwd] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && draft) {
      setTitle(draft.title)
      setCommand(draft.command)
      setCwd(draft.cwd)
    }
  }, [open, draft])

  const save = async (): Promise<void> => {
    if (!draft || title.trim() === '' || command.trim() === '' || saving) return
    setSaving(true)
    try {
      // Editing sends cwd as a plain string so clearing it (empty) actually clears it —
      // undefined is dropped over IPC and would leave the old cwd untouched. Create omits empty.
      if (draft.id) {
        await update(draft.id, { title: title.trim(), command: command.trim(), cwd: cwd.trim() })
      } else {
        await add({ title: title.trim(), command: command.trim(), cwd: cwd.trim() || undefined })
      }
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  // ⌘↵ and ⌘S both save, from any field.
  const onKeyDown = async (e: React.KeyboardEvent): Promise<void> => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'Enter' || e.key.toLowerCase() === 's')) {
      e.preventDefault()
      await save()
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
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Title (e.g. Run Tests)"
          aria-label="Action title"
          data-testid={TestIds.actionTitleInput}
          className="rounded-md"
        />
        <Textarea
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Command — runs in a terminal. ${kbdLabel('mod', '↵')} to save`}
          aria-label="Action command"
          data-testid={TestIds.actionCommandInput}
          rows={3}
          className="resize-none font-mono text-xs"
        />
        <Input
          value={cwd}
          onChange={(e) => setCwd(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Working directory (optional, relative to repo)"
          aria-label="Action working directory"
          className="rounded-md font-mono text-xs"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={title.trim() === '' || command.trim() === '' || saving}
            data-testid={TestIds.actionSave}
            onClick={save}
          >
            {saving ? 'Saving…' : draft?.id ? 'Save' : 'Add action'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
