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
import { kbdLabel } from '@renderer/lib/keyboard'
import { useCardDraftStore } from '@renderer/stores/card-draft'
import { TestIds } from '@shared/test-ids'
import { useEffect, useState } from 'react'

/**
 * The one create/edit-card dialog, driven by the card-draft store and mounted once in
 * AppShell. Opened by the board surfaces' "+"/edit buttons and the ⌘N shortcut. Saves on
 * ⌘↵ or ⌘S.
 */
export function CardComposer(): React.JSX.Element {
  const { add, update } = useCardActions()
  const draft = useCardDraftStore((s) => s.draft)
  const close = useCardDraftStore((s) => s.close)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (draft) {
      setTitle(draft.title)
      setBody(draft.body)
    }
  }, [draft])

  const save = async (): Promise<void> => {
    if (!draft || title.trim() === '' || saving) return
    setSaving(true)
    try {
      if (draft.id) {
        await update(draft.id, { title: title.trim(), body: body.trim() })
      } else {
        await add({ title: title.trim(), body: body.trim() || undefined, status: draft.status })
      }
      close()
    } finally {
      setSaving(false)
    }
  }

  // ⌘↵ and ⌘S both save, from either field.
  const onKeyDown = async (e: React.KeyboardEvent): Promise<void> => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'Enter' || e.key.toLowerCase() === 's')) {
      e.preventDefault()
      await save()
    }
  }

  return (
    <Dialog
      open={draft !== null}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      {/* Cap height so a long description can't push title/footer off-screen;
          title stays fixed; body scrolls inside the dialog. */}
      <DialogContent
        data-testid={TestIds.cardComposer}
        className="flex max-h-[min(600px,90dvh)] flex-col gap-4 overflow-hidden sm:max-w-lg"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{draft?.id ? 'Edit card' : 'New card'}</DialogTitle>
        </DialogHeader>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Title"
          aria-label="Card title"
          data-testid={TestIds.cardTitleInput}
          className="max-h-20 shrink-0 overflow-y-auto rounded-md"
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Details (optional) — ${kbdLabel('mod', '↵')} to save`}
          aria-label="Card details"
          rows={4}
          className="min-h-24 flex-1 resize-none overflow-y-auto"
        />
        <DialogFooter className="shrink-0">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={title.trim() === '' || saving}
            data-testid={TestIds.cardComposerSave}
            onClick={save}
          >
            {saving ? 'Saving…' : draft?.id ? 'Save' : 'Add card'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
