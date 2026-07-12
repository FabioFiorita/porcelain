import { Button } from '@renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useCommentIndex } from '@renderer/hooks/use-comments'
import { useDiffFile } from '@renderer/hooks/use-diff'
import { useReviewedPaths, useToggleReviewed } from '@renderer/hooks/use-reviewed'
import { type LineSelection, lineSelectionFromDom } from '@renderer/lib/line-selection'
import { fileName } from '@renderer/lib/paths'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { FileText, MessageSquarePlus, Square, SquareCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
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
  const repo = useRepoStore((s) => s.repo)
  const openTab = useTabsStore((s) => s.openTab)
  const { hunks, status, error } = useDiffFile(filePath, base)
  const reviewed = useReviewedPaths()
  const { mark, unmark } = useToggleReviewed()
  const isReviewed = reviewed.has(filePath)
  const [lineSel, setLineSel] = useState<LineSelection | null>(null)
  const [commentAnchor, setCommentAnchor] = useState<CommentAnchor | null>(null)
  const commentIndex = useCommentIndex(filePath)

  // While the composer is open on a line range in THIS file, tint those lines so the
  // anchor stays visible after the DOM selection dies (the dialog steals focus).
  const pendingLines = useMemo(() => {
    if (
      !commentAnchor ||
      commentAnchor.path !== filePath ||
      commentAnchor.startLine === undefined
    ) {
      return undefined
    }
    const lines = new Set<number>()
    const end = commentAnchor.endLine ?? commentAnchor.startLine
    for (let line = commentAnchor.startLine; line <= end; line++) lines.add(line)
    return lines
  }, [commentAnchor, filePath])

  // Jump from the diff to the whole file (a preview tab, like the Changes list's
  // "Open file"). Hidden for a deleted file — it no longer exists on disk, so
  // there's nothing to open.
  const openFile = (): void => {
    if (!repo) return
    const absolute = `${repo.path}/${filePath}`
    openTab({
      id: tabId('file', absolute),
      kind: 'file',
      title: fileName(filePath),
      path: absolute,
      preview: true,
    })
  }

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
          {status !== 'deleted' && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground"
                    onClick={openFile}
                    aria-label="Open file"
                  >
                    <FileText />
                  </Button>
                }
              />
              <TooltipContent>Open file</TooltipContent>
            </Tooltip>
          )}
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
          <HunksView
            hunks={hunks}
            filePath={filePath}
            diffMode={diffMode}
            commentIndex={commentIndex}
            pendingLines={pendingLines}
          />
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
