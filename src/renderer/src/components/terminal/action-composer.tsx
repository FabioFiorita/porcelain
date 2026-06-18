import type { Action } from '@main/actions-store'
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
      const fields = {
        title: title.trim(),
        command: command.trim(),
        cwd: cwd.trim() || undefined,
      }
      if (draft.id) await update(draft.id, fields)
      else await add(fields)
      onOpenChange(false)
    } finally {
      setSaving(false)
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
          placeholder="Title (e.g. Run Tests)"
          aria-label="Action title"
          className="rounded-md"
        />
        <Textarea
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={async (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') await save()
          }}
          placeholder="Command — runs in a terminal. ⌘↵ to save"
          aria-label="Action command"
          rows={3}
          className="resize-none font-mono text-xs"
        />
        <Input
          value={cwd}
          onChange={(e) => setCwd(e.target.value)}
          placeholder="Working directory (optional, relative to repo)"
          aria-label="Action working directory"
          className="rounded-md font-mono text-xs"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={title.trim() === '' || command.trim() === '' || saving} onClick={save}>
            {saving ? 'Saving…' : draft?.id ? 'Save' : 'Add action'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
