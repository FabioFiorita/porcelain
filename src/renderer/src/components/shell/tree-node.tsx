import type { DirEntry } from '@main/api'
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
import { dirName } from '@renderer/lib/paths'
import { cn } from '@renderer/lib/utils'
import { useFilePromptStore } from '@renderer/stores/file-prompt'
import { useFileTreeStore } from '@renderer/stores/file-tree'
import { useRepoStore } from '@renderer/stores/repo'
import { useRevealStore } from '@renderer/stores/reveal'
import { useSelectionStore } from '@renderer/stores/selection'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import {
  ChevronRight,
  Columns2,
  Compass,
  Copy,
  Eye,
  EyeOff,
  FilePlus,
  Folder,
  FolderPlus,
  MessageSquarePlus,
  PenLine,
  Pin,
  PinOff,
  Trash2,
} from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'
import { type CommentAnchor, CommentComposer } from '../git/comment-composer'

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
  const { reveal, exploreFlow } = usePathActions(entry.path)
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
          {entry.kind === 'file' && (
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
          <ContextMenuItem onClick={reveal}>
            <Folder />
            Reveal in Finder
          </ContextMenuItem>
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
            <AlertDialogAction onClick={() => trash(entry.path)}>Delete</AlertDialogAction>
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

function TreeNodeImpl({ entry }: { entry: DirEntry }): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const pinTab = useTabsStore((s) => s.pinTab)
  const isSelected = useSelectionStore((s) => s.selected.has(entry.path))
  const toggleSelection = useSelectionStore((s) => s.toggle)
  const setActive = useSelectionStore((s) => s.setActive)
  const prefetchFile = useReadFilePrefetch()
  // A file opened from outside the tree (Changes → Open file) sets the reveal
  // target; the matching row scrolls into view and shows the accent highlight.
  const isRevealed = useRevealStore((s) => s.path === entry.path)
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isRevealed) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [isRevealed])

  if (entry.kind === 'file') {
    return (
      <SidebarMenuItem>
        <EntryContextMenu entry={entry}>
          <SidebarMenuButton
            ref={ref}
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
            <span className="truncate">{entry.name}</span>
          </SidebarMenuButton>
        </EntryContextMenu>
      </SidebarMenuItem>
    )
  }

  return <DirNode entry={entry} />
}

export const TreeNode = memo(TreeNodeImpl)

function DirNode({ entry }: { entry: DirEntry }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const children = useReadDir(entry.path, expanded)
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
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (hasRevealTarget) setExpanded(true)
  }, [hasRevealTarget])
  useEffect(() => {
    if (isRevealed) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [isRevealed])
  // Collapse-all (Explorer header) bumps a nonce; collapse on each bump but not on
  // mount, so a freshly-mounted folder revealed from elsewhere isn't snapped shut.
  const collapseNonce = useFileTreeStore((s) => s.collapseNonce)
  const seenNonce = useRef(collapseNonce)
  useEffect(() => {
    if (collapseNonce !== seenNonce.current) {
      seenNonce.current = collapseNonce
      setExpanded(false)
    }
  }, [collapseNonce])

  return (
    <SidebarMenuItem>
      <Collapsible
        className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
        open={expanded}
        onOpenChange={setExpanded}
      >
        <EntryContextMenu entry={entry}>
          <CollapsibleTrigger
            render={
              <SidebarMenuButton
                ref={ref}
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
                <span className="truncate">{entry.name}</span>
              </SidebarMenuButton>
            }
          />
        </EntryContextMenu>
        <CollapsibleContent>
          <SidebarMenuSub className="mr-0 pr-0">
            {children?.map((child) => (
              <TreeNode key={child.path} entry={child} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  )
}
