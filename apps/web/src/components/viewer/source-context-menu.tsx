import { type CommentAnchor, CommentComposer } from '@renderer/components/git/comment-composer'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { Kbd } from '@renderer/components/ui/kbd'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { useCanRevealInFinder } from '@renderer/hooks/use-reveal-in-finder'
import { kbdLabel } from '@renderer/lib/keyboard'
import { type LineSelection, lineSelectionFromDom } from '@renderer/lib/line-selection'
import { relativeTo } from '@renderer/lib/paths'
import { copyText } from '@renderer/lib/utils'
import { useHubRepoPath } from '@renderer/stores/hub-repo'
import { runUserAction } from '@shared/background'
import { Copy, FileSymlink, FolderOpen, Link2, MessageSquarePlus, Search } from 'lucide-react'
import { useState } from 'react'
import { usePathActions } from './use-path-actions'

export function SourceContextMenu({
  path,
  children,
}: {
  path: string
  children: React.ReactNode
}): React.JSX.Element {
  const [selection, setSelection] = useState('')
  const [lineSel, setLineSel] = useState<LineSelection | null>(null)
  const [commentAnchor, setCommentAnchor] = useState<CommentAnchor | null>(null)
  const repoPath = useHubRepoPath() ?? undefined
  const { copyPath, copyRelativePath, reveal, findReferences } = usePathActions(path)
  const canReveal = useCanRevealInFinder()
  const relativePath = relativeTo(repoPath, path)

  return (
    <>
      <ContextMenu
        onOpenChange={(open: boolean): void => {
          if (!open) {
            setLineSel(null)
            return
          }
          setSelection(window.getSelection()?.toString() ?? '')
        }}
      >
        {/* the ui trigger defaults to select-none; the viewer must stay selectable */}
        <ContextMenuTrigger
          className="block h-full select-text"
          onContextMenu={(event: React.MouseEvent): void => {
            const selected = lineSelectionFromDom()
            if (selected) {
              setLineSel(selected)
              return
            }
            const row = (event.target as HTMLElement).closest('[data-line]')
            const line = row ? Number.parseInt(row.getAttribute('data-line') ?? '', 10) : Number.NaN
            setLineSel(Number.isFinite(line) ? { startLine: line, endLine: line, text: '' } : null)
          }}
        >
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          {selection !== '' ? (
            <>
              <ContextMenuItem
                onClick={() => {
                  runUserAction(
                    () => copyText(selection),
                    (error) => {
                      toastUserActionError('Copy', error)
                    },
                  )
                }}
              >
                <Copy /> Copy
                <ContextMenuShortcut>
                  <Kbd>{kbdLabel('mod', 'C')}</Kbd>
                </ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem
                disabled={selection.trim() === ''}
                onClick={() => findReferences(selection)}
              >
                <Search /> Find references
              </ContextMenuItem>
              {lineSel && (
                <ContextMenuItem
                  onClick={() =>
                    setCommentAnchor({
                      path: relativePath,
                      startLine: lineSel.startLine,
                      endLine: lineSel.endLine,
                      anchorText: lineSel.text.slice(0, 2000),
                    })
                  }
                >
                  <MessageSquarePlus /> Add comment
                </ContextMenuItem>
              )}
            </>
          ) : (
            <>
              {lineSel ? (
                <ContextMenuItem
                  onClick={() =>
                    setCommentAnchor({
                      path: relativePath,
                      startLine: lineSel.startLine,
                      endLine: lineSel.endLine,
                    })
                  }
                >
                  <MessageSquarePlus /> Add comment
                </ContextMenuItem>
              ) : (
                <ContextMenuItem onClick={() => setCommentAnchor({ path: relativePath })}>
                  <MessageSquarePlus /> Comment on file
                </ContextMenuItem>
              )}
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => {
                  copyPath()
                }}
              >
                <Link2 /> Copy path
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => {
                  copyRelativePath()
                }}
              >
                <FileSymlink /> Copy relative path
              </ContextMenuItem>
              {canReveal && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onClick={() => {
                      reveal()
                    }}
                  >
                    <FolderOpen /> Reveal in Finder
                  </ContextMenuItem>
                </>
              )}
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      <CommentComposer
        anchor={commentAnchor}
        open={commentAnchor !== null}
        onOpenChange={(open: boolean): void => {
          if (!open) setCommentAnchor(null)
        }}
      />
    </>
  )
}
