import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { Kbd } from '@renderer/components/ui/kbd'
import { kbdLabel } from '@renderer/lib/keyboard'
import { type LineSelection, lineSelectionFromDom } from '@renderer/lib/line-selection'
import { useRepoStore } from '@renderer/stores/repo'
import {
  Compass,
  Copy,
  FileSymlink,
  FolderOpen,
  Link2,
  MessageSquarePlus,
  Search,
} from 'lucide-react'
import { useState } from 'react'
import { type CommentAnchor, CommentComposer } from '../git/comment-composer'
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
  const repo = useRepoStore((s) => s.repo)
  const { copyPath, copyRelativePath, reveal, findReferences, exploreFlow } = usePathActions(path)

  // Comments store repo-relative paths; the viewer holds an absolute one.
  const relativePath =
    repo && path.startsWith(`${repo.path}/`) ? path.slice(repo.path.length + 1) : path

  const commentOnSelection = (): void => {
    if (!lineSel) return
    setCommentAnchor({
      path: relativePath,
      startLine: lineSel.startLine,
      endLine: lineSel.endLine,
      anchorText: lineSel.text.slice(0, 2000),
    })
  }

  return (
    <>
      <ContextMenu
        onOpenChange={(open) => {
          if (open) {
            setSelection(window.getSelection()?.toString() ?? '')
            setLineSel(lineSelectionFromDom())
          }
        }}
      >
        {/* the ui trigger defaults to select-none; the viewer must stay selectable */}
        <ContextMenuTrigger className="block h-full select-text">{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          {selection !== '' ? (
            <>
              <ContextMenuItem onClick={() => navigator.clipboard.writeText(selection)}>
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
              <ContextMenuItem
                disabled={selection.trim() === ''}
                onClick={() => exploreFlow(selection)}
              >
                <Compass /> Explore flow from “{selection.trim().slice(0, 24)}”
              </ContextMenuItem>
              {lineSel && (
                <ContextMenuItem onClick={commentOnSelection}>
                  <MessageSquarePlus /> Add comment
                </ContextMenuItem>
              )}
            </>
          ) : (
            <>
              <ContextMenuItem onClick={() => setCommentAnchor({ path: relativePath })}>
                <MessageSquarePlus /> Comment on file
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={copyPath}>
                <Link2 /> Copy path
              </ContextMenuItem>
              <ContextMenuItem onClick={copyRelativePath}>
                <FileSymlink /> Copy relative path
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={reveal}>
                <FolderOpen /> Reveal in Finder
              </ContextMenuItem>
            </>
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
    </>
  )
}
