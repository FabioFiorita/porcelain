import type { DirEntry } from '@backend/api'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@renderer/components/ui/collapsible'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { SidebarMenuButton, SidebarMenuItem, SidebarMenuSub } from '@renderer/components/ui/sidebar'
import { FileTypeIcon, FolderIcon } from '@renderer/components/viewer/file-icon'
import { usePathActions } from '@renderer/components/viewer/use-path-actions'
import {
  useDuplicatePath,
  useEntryActions,
  useReadDir,
  useReadFilePrefetch,
  useTrashPath,
} from '@renderer/hooks/use-files'
import { useIsMobile } from '@renderer/hooks/use-mobile'
import { dirName } from '@renderer/lib/paths'
import { isBrowser } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { useFilePromptStore } from '@renderer/stores/file-prompt'
import { useFileTreeStore } from '@renderer/stores/file-tree'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { useRevealStore } from '@renderer/stores/reveal'
import { useSelectionStore } from '@renderer/stores/selection'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { useTreeDirsStore } from '@renderer/stores/tree-dirs'
import { TestIds } from '@shared/test-ids'
import {
  ChevronRight,
  Columns2,
  Compass,
  Copy,
  Eye,
  EyeOff,
  FilePlus,
  FileSymlink,
  Folder,
  FolderPlus,
  Link2,
  MessageSquarePlus,
  PenLine,
  Pin,
  PinOff,
  Trash2,
} from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { type CommentAnchor, CommentComposer } from '../git/comment-composer'

// A reveal highlight lingers this long after the row scrolls into view, then the
// target is cleared so a later Files-tab remount doesn't re-expand its ancestors.
const REVEAL_LINGER_MS = 2000

function EntryContextMenu({
  entry,
  children,
}: {
  entry: DirEntry
  children: React.ReactNode
}): React.JSX.Element {
  const { hide, unhide, hideSelected, pin, unpin, selectionSize } = useEntryActions(entry)
  const batchSize = selectionSize + (useSelectionStore.getState().selected.has(entry.path) ? 0 : 1)
  const openTabToSide = useTabsStore((s) => s.openTabToSide)
  // Split panes are unusable at phone width — hide the "Open to the Side" entry there.
  const isMobile = useIsMobile()
  const { reveal, exploreFlow, copyPath, copyRelativePath } = usePathActions(entry.path)
  const trash = useTrashPath()
  const duplicate = useDuplicatePath()
  const newFile = useFilePromptStore((s) => s.newFile)
  const newFolder = useFilePromptStore((s) => s.newFolder)
  const startRename = useFilePromptStore((s) => s.rename)
  const repo = useRepoStore((s) => s.repo)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [commentAnchor, setCommentAnchor] = useState<CommentAnchor | null>(null)
  // Comments store repo-relative paths; the tree holds absolute ones.
  const relativePath =
    repo && entry.path.startsWith(`${repo.path}/`)
      ? entry.path.slice(repo.path.length + 1)
      : entry.path
  // New file/folder land in this directory (the folder itself, or a file's parent).
  const dir = entry.kind === 'dir' ? entry.path : dirName(entry.path)

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => newFile(dir)}>
            <FilePlus />
            New File
          </ContextMenuItem>
          <ContextMenuItem onClick={() => newFolder(dir)}>
            <FolderPlus />
            New Folder
          </ContextMenuItem>
          <ContextMenuSeparator />
          {entry.kind === 'file' && !isMobile && (
            <ContextMenuItem
              onClick={() =>
                openTabToSide({
                  id: tabId('file', entry.path),
                  kind: 'file',
                  title: entry.name,
                  path: entry.path,
                })
              }
            >
              <Columns2 />
              Open to the Side
            </ContextMenuItem>
          )}
          {entry.kind === 'file' && (
            <ContextMenuItem onClick={() => exploreFlow()}>
              <Compass />
              Explore feature flow
            </ContextMenuItem>
          )}
          {entry.kind === 'file' && (
            <ContextMenuItem onClick={() => setCommentAnchor({ path: relativePath })}>
              <MessageSquarePlus />
              Comment on file
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={copyPath}>
            <Link2 />
            Copy Path
          </ContextMenuItem>
          <ContextMenuItem onClick={copyRelativePath}>
            <FileSymlink />
            Copy Relative Path
          </ContextMenuItem>
          {/* Reveal in Finder is a shell-only action — hidden in the browser client. */}
          {!isBrowser && (
            <ContextMenuItem onClick={reveal}>
              <Folder />
              Reveal in Finder
            </ContextMenuItem>
          )}
          {entry.pinned ? (
            <ContextMenuItem onClick={unpin}>
              <PinOff />
              Unpin
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onClick={pin}>
              <Pin />
              Pin
            </ContextMenuItem>
          )}
          {selectionSize > 0 ? (
            <ContextMenuItem onClick={hideSelected}>
              <EyeOff />
              Hide {batchSize} items
            </ContextMenuItem>
          ) : entry.hidden ? (
            <ContextMenuItem onClick={unhide}>
              <Eye />
              Unhide
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onClick={hide}>
              <EyeOff />
              Hide
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => startRename(entry.path, entry.name)}>
            <PenLine />
            Rename
          </ContextMenuItem>
          <ContextMenuItem onClick={() => duplicate(entry.path)}>
            <Copy />
            Duplicate
          </ContextMenuItem>
          <ContextMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {entry.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This moves “{entry.name}” to the Trash. You can restore it from there.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => trash(entry.path)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

function TreeNodeImpl({
  entry,
  parentCollapseNonce = 0,
}: {
  entry: DirEntry
  parentCollapseNonce?: number
}): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const pinTab = useTabsStore((s) => s.pinTab)
  const isSelected = useSelectionStore((s) => s.selected.has(entry.path))
  const toggleSelection = useSelectionStore((s) => s.toggle)
  const setActive = useSelectionStore((s) => s.setActive)
  const prefetchFile = useReadFilePrefetch()
  // A file opened from outside the tree (Changes → Open file) sets the reveal
  // target; the matching row scrolls into view and shows the accent highlight.
  const isRevealed = useRevealStore((s) => s.path === entry.path)
  const clearReveal = useRevealStore((s) => s.clear)
  // The tree stays mounted while other sidebar tabs show (CSS-hidden, so folder
  // expansion survives tab switches); scrollIntoView on a hidden element is a
  // no-op, so the leaf waits for the Files tab before consuming the reveal.
  const isTreeVisible = usePreferencesStore((s) => s.sidebarTab === 'files')
  const ref = useRef<HTMLButtonElement>(null)

  // This file is the reveal leaf: once it scrolls into view, let the highlight
  // linger, then clear the target so a later remount doesn't re-expand the chain.
  useEffect(() => {
    if (!isRevealed || !isTreeVisible) return
    ref.current?.scrollIntoView({ block: 'nearest' })
    const timer = setTimeout(clearReveal, REVEAL_LINGER_MS)
    return () => clearTimeout(timer)
  }, [isRevealed, isTreeVisible, clearReveal])

  if (entry.kind === 'file') {
    return (
      <SidebarMenuItem>
        <EntryContextMenu entry={entry}>
          <SidebarMenuButton
            ref={ref}
            data-testid={TestIds.treeEntry(entry.name)}
            data-path={entry.path}
            className={cn(
              'text-sm-minus',
              entry.hidden && 'opacity-50',
              (isSelected || isRevealed) && 'bg-sidebar-accent',
            )}
            onMouseEnter={() => prefetchFile(entry.path)}
            onClick={(e) => {
              setActive({ path: entry.path, kind: 'file' })
              if (e.metaKey || e.ctrlKey) {
                toggleSelection(entry.path)
                return
              }
              openTab({
                id: tabId('file', entry.path),
                kind: 'file',
                title: entry.name,
                path: entry.path,
                preview: true,
              })
            }}
            onDoubleClick={() => pinTab(tabId('file', entry.path))}
          >
            <FileTypeIcon name={entry.name} />
            <span className="truncate font-mono">{entry.name}</span>
          </SidebarMenuButton>
        </EntryContextMenu>
      </SidebarMenuItem>
    )
  }

  return <DirNode entry={entry} parentCollapseNonce={parentCollapseNonce} />
}

export const TreeNode = memo(TreeNodeImpl)

function DirNode({
  entry,
  parentCollapseNonce,
}: {
  entry: DirEntry
  parentCollapseNonce: number
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const children = useReadDir(entry.path, expanded)
  // Register this dir as watched while it's open so an external add/remove inside it
  // live-refreshes the tree (see `useWatchTreeDirs`); cleanup on collapse or unmount.
  const addWatchedDir = useTreeDirsStore((s) => s.add)
  const removeWatchedDir = useTreeDirsStore((s) => s.remove)
  useEffect(() => {
    if (!expanded) return
    addWatchedDir(entry.path)
    return () => removeWatchedDir(entry.path)
  }, [expanded, entry.path, addWatchedDir, removeWatchedDir])
  const isSelected = useSelectionStore((s) => s.selected.has(entry.path))
  const toggleSelection = useSelectionStore((s) => s.toggle)
  const setActive = useSelectionStore((s) => s.setActive)
  // Open this folder when a revealed file lives inside it (or this folder IS the
  // reveal target — the Cmd+P finder picking a folder), so the tree expands all
  // the way down to whatever was opened from elsewhere. Each ancestor opens in
  // turn — opening loads its children (lazy `useReadDir`), mounting the next
  // level, which repeats the check until the leaf row mounts and scrolls itself
  // into view. Controlled `open` lets the effect drive the Collapsible.
  const isRevealed = useRevealStore((s) => s.path === entry.path)
  const hasRevealTarget = useRevealStore(
    (s) => s.path === entry.path || (s.path?.startsWith(`${entry.path}/`) ?? false),
  )
  const clearReveal = useRevealStore((s) => s.clear)
  // Same visibility gate as the file leaf: the tree is CSS-hidden under other
  // sidebar tabs, so defer the scroll/clear until the Files tab shows it.
  const isTreeVisible = usePreferencesStore((s) => s.sidebarTab === 'files')
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (hasRevealTarget) setExpanded(true)
  }, [hasRevealTarget])
  // When this folder IS the reveal leaf (a revealed folder), scroll it in and
  // clear the target after the highlight lingers — same as a revealed file.
  useEffect(() => {
    if (!isRevealed || !isTreeVisible) return
    ref.current?.scrollIntoView({ block: 'nearest' })
    const timer = setTimeout(clearReveal, REVEAL_LINGER_MS)
    return () => clearTimeout(timer)
  }, [isRevealed, isTreeVisible, clearReveal])
  // Cascade collapse: this folder's own local nonce, bumped whenever it collapses
  // (user click or its own cascade), is passed down to children so re-expanding a
  // parent shows its inner folders freshly collapsed rather than stale-expanded.
  const [subtreeCollapseNonce, setSubtreeCollapseNonce] = useState(0)
  const collapseSubtree = useCallback(() => {
    setExpanded(false)
    setSubtreeCollapseNonce((n) => n + 1)
  }, [])
  // Collapse signals from above: the global collapse-all nonce (Explorer header)
  // and the parent's cascade nonce, summed into one monotonic value. Collapse on
  // each change but not on mount, so a freshly-mounted folder revealed from
  // elsewhere isn't snapped shut, and the reveal-driven expansion survives.
  const collapseNonce = useFileTreeStore((s) => s.collapseNonce)
  const externalCollapse = collapseNonce + parentCollapseNonce
  const seenNonce = useRef(externalCollapse)
  useEffect(() => {
    if (externalCollapse !== seenNonce.current) {
      seenNonce.current = externalCollapse
      collapseSubtree()
    }
  }, [externalCollapse, collapseSubtree])
  // What children watch: this node's inherited signal plus its own collapse nonce.
  const childCollapseNonce = parentCollapseNonce + subtreeCollapseNonce

  return (
    <SidebarMenuItem>
      <Collapsible
        className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
        open={expanded}
        onOpenChange={(open) => (open ? setExpanded(true) : collapseSubtree())}
      >
        <EntryContextMenu entry={entry}>
          <CollapsibleTrigger
            render={
              <SidebarMenuButton
                ref={ref}
                data-testid={TestIds.treeEntry(entry.name)}
                data-path={entry.path}
                className={cn(
                  'text-sm-minus',
                  entry.hidden && 'opacity-50',
                  (isSelected || isRevealed) && 'bg-sidebar-accent',
                )}
                onClick={(e) => {
                  setActive({ path: entry.path, kind: 'dir' })
                  if (e.metaKey || e.ctrlKey) {
                    e.preventDefault()
                    e.stopPropagation()
                    toggleSelection(entry.path)
                  }
                }}
              >
                <ChevronRight className="transition-transform" />
                <FolderIcon open={expanded} />
                <span className="truncate font-mono">{entry.name}</span>
              </SidebarMenuButton>
            }
          />
        </EntryContextMenu>
        <CollapsibleContent>
          <SidebarMenuSub className="mr-0 pr-0">
            {children?.map((child) => (
              <TreeNode key={child.path} entry={child} parentCollapseNonce={childCollapseNonce} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  )
}
