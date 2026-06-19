import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { Textarea } from '@renderer/components/ui/textarea'
import { type NewCommentInput, useCommentActions } from '@renderer/hooks/use-comments'
import { kbdLabel } from '@renderer/lib/keyboard'
import { useEffect, useState } from 'react'

export interface CommentAnchor {
  /** Repo-relative path. */
  path: string
  startLine?: number
  endLine?: number
  anchorText?: string
}

/** Where a comment is anchored, as a `path` or `path:start–end`, for display. */
function describeAnchor(anchor: CommentAnchor): string {
  if (anchor.startLine === undefined) return anchor.path
  if (anchor.endLine && anchor.endLine !== anchor.startLine) {
    return `${anchor.path}:${anchor.startLine}–${anchor.endLine}`
  }
  return `${anchor.path}:${anchor.startLine}`
}

/**
 * Controlled dialog to write a review comment anchored to a line range (or a whole
 * file when there's no range). Saves to the comment channel the agent reads over MCP.
 */
export function CommentComposer({
  anchor,
  open,
  onOpenChange,
}: {
  anchor: CommentAnchor | null
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const { add } = useCommentActions()
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset the field each time the dialog opens for a fresh anchor.
  useEffect(() => {
    if (open) setBody('')
  }, [open])

  const save = async (): Promise<void> => {
    if (!anchor || body.trim() === '' || saving) return
    setSaving(true)
    try {
      const input: NewCommentInput = { path: anchor.path, body: body.trim() }
      if (anchor.startLine !== undefined) input.startLine = anchor.startLine
      if (anchor.endLine !== undefined) input.endLine = anchor.endLine
      if (anchor.anchorText !== undefined) input.anchorText = anchor.anchorText
      await add(input)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add comment</DialogTitle>
          {anchor && (
            <DialogDescription className="font-mono text-xs">
              {describeAnchor(anchor)}
            </DialogDescription>
          )}
        </DialogHeader>
        {anchor?.anchorText && (
          <pre className="max-h-28 overflow-auto rounded-md bg-card p-2 font-mono text-[11px] text-muted-foreground">
            {anchor.anchorText}
          </pre>
        )}
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={async (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') await save()
          }}
          placeholder={`What should the agent know about this? — ${kbdLabel('mod', '↵')} to save`}
          aria-label="Comment"
          rows={4}
          className="resize-none"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={body.trim() === '' || saving} onClick={save}>
            {saving ? 'Saving…' : 'Comment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
