import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { useDiffFile } from '@renderer/hooks/use-diff'
import { type LineSelection, lineSelectionFromDom } from '@renderer/lib/line-selection'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { MessageSquarePlus } from 'lucide-react'
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
  const [lineSel, setLineSel] = useState<LineSelection | null>(null)
  const [commentAnchor, setCommentAnchor] = useState<CommentAnchor | null>(null)

  if (error) return <p className="p-4 text-sm text-destructive">{error.message}</p>
  if (hunks === undefined) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-1">
        <span className="truncate font-mono text-xs text-muted-foreground">{filePath}</span>
        <DiffModeToggle />
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
