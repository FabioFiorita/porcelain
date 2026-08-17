import { Button } from '@renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useDiffFile, useReviewedPaths, useToggleReviewed } from '@renderer/features/git'
import { useCommentIndex } from '@renderer/features/review'
import { useIsMobile } from '@renderer/hooks/use-mobile'
import { raisedCardClass, viewerWellClass } from '@renderer/lib/controls'
import { type LineSelection, lineSelectionFromDom } from '@renderer/lib/line-selection'
import { fileName } from '@renderer/lib/paths'
import { cn } from '@renderer/lib/utils'
import { useHubRepoPath } from '@renderer/stores/hub-repo'
import { activeTabTarget, targetedTab } from '@renderer/stores/hub-tabs'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useTabsStore } from '@renderer/stores/tabs'
import { TestIds } from '@shared/test-ids'
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
  const prefDiffMode = usePreferencesStore((s) => s.diffMode)
  // Split needs two code columns — force unified on phone for a readable glance.
  const isMobile = useIsMobile()
  const diffMode = isMobile ? 'unified' : prefDiffMode
  const repoPath = useHubRepoPath()
  const openTab = useTabsStore((s) => s.openTab)
  const { hunks, status, image, binary, error } = useDiffFile(filePath, base)
  const reviewed = useReviewedPaths()
  const { mark, unmark } = useToggleReviewed()
  const isReviewed = reviewed.has(filePath)
  const [lineSel, setLineSel] = useState<LineSelection | null>(null)
  const [commentAnchor, setCommentAnchor] = useState<CommentAnchor | null>(null)
  const commentIndex = useCommentIndex(filePath)
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
  const handleOpenFile = (): void => {
    if (repoPath === null) return
    const absolute = `${repoPath}/${filePath}`
    openTab(
      targetedTab(
        'file',
        absolute,
        { title: fileName(filePath), preview: true },
        activeTabTarget(),
      ),
    )
  }

  if (error) return <p className="p-4 text-sm text-destructive">{error.message}</p>
  if (hunks === undefined && image === undefined && !binary) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  }

  // Image / binary diffs: no text hunks. Show a preview (images) or a quiet
  // placeholder instead of the old UTF-8 dump of PNG bytes.
  const nonText = image !== undefined || binary

  return (
    <div data-testid={TestIds.codeWell} className={viewerWellClass}>
      <div
        data-testid={TestIds.codeCard}
        className={cn(raisedCardClass, 'flex h-full min-h-0 flex-col')}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-1">
          <span className="truncate font-mono text-xs text-muted-foreground">{filePath}</span>
          <div className="flex shrink-0 items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className={cn(
                      isReviewed ? 'text-success' : 'text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => {
                      if (isReviewed) unmark(filePath)
                      else mark(filePath)
                    }}
                    aria-label={isReviewed ? 'Unmark reviewed' : 'Mark reviewed'}
                    data-testid={TestIds.diffReviewed(filePath)}
                  >
                    {isReviewed ? <SquareCheck /> : <Square />}
                  </Button>
                }
              />
              <TooltipContent>{isReviewed ? 'Unmark reviewed' : 'Mark reviewed'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setCommentAnchor({ path: filePath })}
                    aria-label="Comment on file"
                  >
                    <MessageSquarePlus />
                  </Button>
                }
              />
              <TooltipContent>Comment on file</TooltipContent>
            </Tooltip>
            {status !== 'deleted' && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground"
                      onClick={handleOpenFile}
                      aria-label="Open file"
                    >
                      <FileText />
                    </Button>
                  }
                />
                <TooltipContent>Open file</TooltipContent>
              </Tooltip>
            )}
            {!nonText && <DiffModeToggle />}
          </div>
        </div>
        {image !== undefined ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-auto p-8">
            <img
              src={image.dataUrl}
              alt={filePath}
              className="max-h-full max-w-full object-contain"
            />
            <p className="text-2xs text-muted-foreground">
              {status === 'untracked' || status === 'added' ? 'New image' : 'Image changed'} ·
              binary diff
            </p>
          </div>
        ) : binary ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Binary file
          </div>
        ) : (
          <ContextMenu
            onOpenChange={(open: boolean): void => {
              if (!open) setLineSel(null)
            }}
          >
            {/* select-text so the diff stays selectable (the ui trigger defaults to
              select-none) — selecting lines is how you anchor a comment. */}
            <ContextMenuTrigger
              className="block min-h-0 flex-1 select-text"
              onContextMenu={(event: React.MouseEvent): void => {
                const selected = lineSelectionFromDom()
                if (selected) {
                  setLineSel(selected)
                  return
                }
                const row = (event.target as HTMLElement).closest('[data-line]')
                const line = row
                  ? Number.parseInt(row.getAttribute('data-line') ?? '', 10)
                  : Number.NaN
                setLineSel(
                  Number.isFinite(line) ? { startLine: line, endLine: line, text: '' } : null,
                )
              }}
            >
              <HunksView
                hunks={hunks ?? []}
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
        )}
      </div>
      <CommentComposer
        anchor={commentAnchor}
        open={commentAnchor !== null}
        onOpenChange={(open: boolean): void => {
          if (!open) setCommentAnchor(null)
        }}
      />
    </div>
  )
}
