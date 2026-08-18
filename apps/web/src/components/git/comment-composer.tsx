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
import { CodeLine, useTokenizedLines } from '@renderer/components/viewer/code-line'
import { type NewComment, useCommentActions } from '@renderer/features/review'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { languageFor } from '@renderer/lib/highlight'
import { kbdLabel } from '@renderer/lib/keyboard'
import { fileName } from '@renderer/lib/paths'
import { runUserAction } from '@shared/background'
import { useEffect, useState } from 'react'

export interface CommentAnchor {
  /** Repo-relative path. */
  path: string
  startLine?: number
  endLine?: number
  anchorText?: string
}

/** Human-readable anchor: "Line N of file.ts", "Lines N–M of file.ts", or the filename. */
function describeAnchor(anchor: CommentAnchor): string {
  const name = fileName(anchor.path)
  if (anchor.startLine === undefined) return name
  if (anchor.endLine && anchor.endLine !== anchor.startLine) {
    return `Lines ${anchor.startLine}–${anchor.endLine} of ${name}`
  }
  return `Line ${anchor.startLine} of ${name}`
}

/** Selected lines, tokenized with the same Shiki path as the file viewer. */
function CommentSnippet({ path, text }: { path: string; text: string }): React.JSX.Element {
  const lines = text.split('\n')
  const tokenLines = useTokenizedLines(text, languageFor(path))
  return (
    <div className="max-h-28 overflow-auto rounded-md bg-card p-2 font-mono text-xs-minus leading-5">
      {lines.map((line, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: snippet lines are static per open
        <CodeLine key={i} tokens={tokenLines?.[i] ?? null} text={line} />
      ))}
    </div>
  )
}

/**
 * Controlled dialog to write a review comment anchored to a line range (or a whole
 * file when there's no range). Saves to the comment channel the agent reads through MCP.
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

  const handleSave = (): void => {
    if (!anchor || body.trim() === '' || saving) return
    setSaving(true)
    runUserAction(
      async () => {
        const input: NewComment = { path: anchor.path, body: body.trim() }
        if (anchor.startLine !== undefined) input.startLine = anchor.startLine
        if (anchor.endLine !== undefined) input.endLine = anchor.endLine
        if (anchor.anchorText !== undefined) input.anchorText = anchor.anchorText
        await add(input)
        onOpenChange(false)
      },
      (error) => {
        toastUserActionError('Add comment', error)
      },
      () => {
        setSaving(false)
      },
    )
  }

  // ⌘↵ and ⌘S both save.
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
          <DialogTitle>Add comment</DialogTitle>
          {anchor && (
            <DialogDescription className="font-mono text-xs break-all">
              {describeAnchor(anchor)}
            </DialogDescription>
          )}
        </DialogHeader>
        {anchor?.anchorText && <CommentSnippet path={anchor.path} text={anchor.anchorText} />}
        <Textarea
          value={body}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>): void => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`What should the agent know about this? — ${kbdLabel('mod', '↵')} to save`}
          aria-label="Comment"
          rows={4}
          className="resize-none"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={body.trim() === '' || saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Comment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
