import type { BoardCard, CardStatus } from '@main/board-store'
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
import { useCardActions } from '@renderer/hooks/use-board'
import { useEffect, useState } from 'react'

export interface CardDraft {
  /** Present when editing an existing card; absent when creating a new one. */
  id?: string
  title: string
  body: string
  /** Column a new card lands in. */
  status: CardStatus
}

/** Build an edit draft from an existing card (used by both board surfaces). */
export function draftFromCard(card: BoardCard): CardDraft {
  return { id: card.id, title: card.title, body: card.body ?? '', status: card.status }
}

/** Controlled dialog to create or edit a board card (title + optional body). */
export function CardComposer({
  draft,
  open,
  onOpenChange,
}: {
  draft: CardDraft | null
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const { add, update } = useCardActions()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && draft) {
      setTitle(draft.title)
      setBody(draft.body)
    }
  }, [open, draft])

  const save = async (): Promise<void> => {
    if (!draft || title.trim() === '' || saving) return
    setSaving(true)
    try {
      if (draft.id) {
        await update(draft.id, { title: title.trim(), body: body.trim() })
      } else {
        await add({ title: title.trim(), body: body.trim() || undefined, status: draft.status })
      }
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{draft?.id ? 'Edit card' : 'New card'}</DialogTitle>
        </DialogHeader>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          aria-label="Card title"
          className="rounded-md"
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={async (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') await save()
          }}
          placeholder="Details (optional) — ⌘↵ to save"
          aria-label="Card details"
          rows={4}
          className="resize-none"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={title.trim() === '' || saving} onClick={save}>
            {saving ? 'Saving…' : draft?.id ? 'Save' : 'Add card'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
