import type { FlowFile } from '@backend/flow'
import { Button } from '@renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useCommentIndex } from '@renderer/hooks/use-comments'
import { useCommitDiff } from '@renderer/hooks/use-diff'
import { useCommitFlow, useCommitMessage } from '@renderer/hooks/use-history'
import { type LineSelection, lineSelectionFromDom } from '@renderer/lib/line-selection'
import { fileName } from '@renderer/lib/paths'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { useRevealStore } from '@renderer/stores/reveal'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { FileText, MessageSquarePlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { type CommentAnchor, CommentComposer } from './comment-composer'
import { DiffModeToggle } from './diff-mode-toggle'
import { HunksView } from './hunks-view'

// A file row in the commit's flow list. Right-click matches the Changes list: "Open
// file" (full file tab + flip to Files + reveal in the tree) and "Comment on file".
function CommitFileRow({
  file,
  repoPath,
  selected,
  onSelect,
  onComment,
}: {
  file: FlowFile
  repoPath: string
  selected: boolean
  onSelect: (path: string) => void
  onComment: (path: string) => void
}): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const setSidebarTab = usePreferencesStore((s) => s.setSidebarTab)
  const reveal = useRevealStore((s) => s.reveal)
  const name = fileName(file.path)

  // Opens the FULL file (not the diff the row's click shows), flips the sidebar to
  // Files, and reveals the file in the tree — identical to the Changes list.
  const openFile = (): void => {
    const absolute = `${repoPath}/${file.path}`
    openTab({ id: tabId('file', absolute), kind: 'file', title: name, path: absolute })
    setSidebarTab('files')
    reveal(absolute)
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <button
            type="button"
            onClick={() => onSelect(file.path)}
            className={cn(
              'block w-full truncate px-3 py-1 text-left text-xs',
              selected
                ? 'bg-sidebar-accent text-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent/50',
            )}
          />
        }
      >
        {name}
      </ContextMenuTrigger>
      <ContextMenuContent>
        {/* Deleted files no longer exist on disk, so opening them would error. */}
        {file.status !== 'deleted' && (
          <ContextMenuItem onClick={openFile}>
            <FileText />
            Open file
          </ContextMenuItem>
        )}
        {/* file.path is repo-relative — exactly what a comment anchors to. The
            composer is a single instance lifted to CommitView (one per view, not
            per row), so the row just reports the path to comment on. */}
        <ContextMenuItem onClick={() => onComment(file.path)}>
          <MessageSquarePlus />
          Comment on file
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

// The commit's diff for one file — read-only, but line/file comments anchor here
// exactly like the working-tree diff (DiffView): right-click to add a comment, and
// existing comments render as gutter markers.
function CommitFileDiff({ hash, filePath }: { hash: string; filePath: string }): React.JSX.Element {
  const diffMode = usePreferencesStore((s) => s.diffMode)
  const { hunks, error } = useCommitDiff(hash, filePath)
  const [lineSel, setLineSel] = useState<LineSelection | null>(null)
  const [commentAnchor, setCommentAnchor] = useState<CommentAnchor | null>(null)
  // Tradeoff: comments anchor to the new-side line numbers of the diff they were
  // authored on, so on a historical commit's diff an existing marker can land on
  // the wrong line (and a comment authored here can mislocate on the working-tree
  // diff). Accepted — the markers are low-stakes tints, and anchorText carries the
  // real anchor for the agent.
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

  if (error) return <p className="p-4 text-sm text-destructive">{error.message}</p>
  if (hunks === undefined) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="flex h-full flex-col">
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

export function CommitView({ hash }: { hash: string }): React.JSX.Element {
  const [selected, setSelected] = useState<string | null>(null)
  // A single composer for the whole file list — rows report which path to comment
  // on rather than each mounting their own (a 50-file commit would mount 50).
  const [commentAnchor, setCommentAnchor] = useState<CommentAnchor | null>(null)
  const { groups } = useCommitFlow(hash)
  const message = useCommitMessage(hash)
  const repo = useRepoStore((s) => s.repo)
  const openTab = useTabsStore((s) => s.openTab)

  if (!repo || groups === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  }

  const allFiles = groups.flatMap((g) => g.files)
  const selectedFile = selected ?? allFiles[0]?.path ?? null
  const selectedStatus = allFiles.find((f) => f.path === selectedFile)?.status

  // Jump from the diff to the whole file (a preview tab, like DiffView's toolbar
  // button). Hidden for a deleted file — it no longer exists on disk.
  const openFile = (): void => {
    if (!selectedFile) return
    const absolute = `${repo.path}/${selectedFile}`
    openTab({
      id: tabId('file', absolute),
      kind: 'file',
      title: fileName(selectedFile),
      path: absolute,
      preview: true,
    })
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="w-64 shrink-0 overflow-y-auto border-r">
        <div className="border-b px-3 py-2">
          <p className="whitespace-pre-wrap break-words text-sm-minus text-foreground">
            {message ?? '…'}
          </p>
          <p className="mt-1 font-mono text-xs-minus text-muted-foreground">{hash.slice(0, 12)}</p>
        </div>
        {groups.map((group) => (
          <div key={group.layer}>
            <p className="h-6 px-2 text-2xs uppercase tracking-wider text-muted-foreground/70 flex items-center">
              {group.layer}
            </p>
            {group.files.map((file) => (
              <CommitFileRow
                key={file.path}
                file={file}
                repoPath={repo.path}
                selected={file.path === selectedFile}
                onSelect={setSelected}
                onComment={(path) => setCommentAnchor({ path })}
              />
            ))}
          </div>
        ))}
        {allFiles.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">No files changed</p>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-1">
          <span className="truncate font-mono text-xs text-muted-foreground">{selectedFile}</span>
          <div className="flex shrink-0 items-center gap-1.5">
            {selectedFile && selectedStatus !== 'deleted' && (
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
        <div className="min-h-0 flex-1">
          {selectedFile ? (
            <CommitFileDiff hash={hash} filePath={selectedFile} />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Empty commit</p>
          )}
        </div>
      </div>
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
