import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { useDiffFile } from '@renderer/hooks/use-diff'
import { useReviewedPaths, useToggleReviewed } from '@renderer/hooks/use-reviewed'
import { type LineSelection, lineSelectionFromDom } from '@renderer/lib/line-selection'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { MessageSquarePlus, Square, SquareCheck } from 'lucide-react'
import { useState } from 'react'
import { type CommentAnchor, CommentComposer } from './comment-composer'
import { DiffModeToggle } from './diff-mode-toggle'
import { HunksView } from './hunks-view'

export function DiffView({
  filePath,
  base,
}: {
  filePath: string
  base?: string
}): React.JSX.Element {
  const diffMode = usePreferencesStore((s) => s.diffMode)
  const { hunks, error } = useDiffFile(filePath, base)
  const reviewed = useReviewedPaths()
  const { mark, unmark } = useToggleReviewed()
  const isReviewed = reviewed.has(filePath)
  const [lineSel, setLineSel] = useState<LineSelection | null>(null)
  const [commentAnchor, setCommentAnchor] = useState<CommentAnchor | null>(null)

  if (error) return <p className="p-4 text-sm text-destructive">{error.message}</p>
  if (hunks === undefined) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-1">
        <span className="truncate font-mono text-xs text-muted-foreground">{filePath}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Mark the file reviewed right where you read it — shares state with
              the Changes list's reviewed indicator (useReviewedPaths). */}
          <button
            type="button"
            onClick={async () => (isReviewed ? unmark(filePath) : mark(filePath))}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              isReviewed
                ? 'text-success hover:bg-accent/50'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            {isReviewed ? <SquareCheck className="size-3.5" /> : <Square className="size-3.5" />}
            {isReviewed ? 'Reviewed' : 'Mark reviewed'}
          </button>
          <DiffModeToggle />
        </div>
      </div>
      <ContextMenu
        onOpenChange={(open) => {
          if (open) setLineSel(lineSelectionFromDom())
        }}
      >
        {/* select-text so the diff stays selectable (the ui trigger defaults to
            select-none) — selecting lines is how you anchor a comment. */}
        <ContextMenuTrigger className="block min-h-0 flex-1 select-text">
          <HunksView hunks={hunks} filePath={filePath} diffMode={diffMode} />
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          {lineSel ? (
            <ContextMenuItem
              onClick={() =>
                setCommentAnchor({
                  path: filePath,
                  startLine: lineSel.startLine,
                  endLine: lineSel.endLine,
                  anchorText: lineSel.text.slice(0, 2000),
                })
              }
            >
              <MessageSquarePlus /> Add comment
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onClick={() => setCommentAnchor({ path: filePath })}>
              <MessageSquarePlus /> Comment on file
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
      <CommentComposer
        anchor={commentAnchor}
        open={commentAnchor !== null}
        onOpenChange={(open) => {
          if (!open) setCommentAnchor(null)
        }}
      />
    </div>
  )
}
