import type { FlowFile } from '@porcelain/contracts/git'
import { Button } from '@renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useCommitDiff, useCommitFlow, useCommitMessage } from '@renderer/features/git'
import { raisedCardClass, viewerWellClass } from '@renderer/lib/controls'
import { fileName } from '@renderer/lib/paths'
import { cn } from '@renderer/lib/utils'
import { useHubRepoPath } from '@renderer/stores/hub-repo'
import { activeTabTarget, targetedTab } from '@renderer/stores/hub-tabs'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRevealStore } from '@renderer/stores/reveal'
import { useTabsStore } from '@renderer/stores/tabs'
import { TestIds } from '@shared/test-ids'
import { FileText, MessageSquarePlus, Rows3 } from 'lucide-react'
import { useState } from 'react'
import { changesetTabKey } from './changeset-view'
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
}: {
  file: FlowFile
  repoPath: string
  selected: boolean
  onSelect: (path: string) => void
}): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const setSidebarTab = usePreferencesStore((s) => s.setSidebarTab)
  const reveal = useRevealStore((s) => s.reveal)
  const name = fileName(file.path)
  const [commentAnchor, setCommentAnchor] = useState<CommentAnchor | null>(null)

  // Opens the FULL file (not the diff the row's click shows), flips the sidebar to
  // Files, and reveals the file in the tree — identical to the Changes list.
  const handleOpenFile = (): void => {
    const absolute = `${repoPath}/${file.path}`
    openTab(targetedTab('file', absolute, { title: name }, activeTabTarget()))
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
              'block w-full truncate px-3 py-1 text-left font-mono text-xs',
              selected
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50',
            )}
          />
        }
      >
        {name}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => setCommentAnchor({ path: file.path })}>
          <MessageSquarePlus />
          Comment on file
        </ContextMenuItem>
        {/* Deleted files no longer exist on disk, so opening them would error. */}
        {file.status !== 'deleted' && (
          <ContextMenuItem onClick={handleOpenFile}>
            <FileText />
            Open file
          </ContextMenuItem>
        )}
      </ContextMenuContent>
      <CommentComposer
        anchor={commentAnchor}
        open={commentAnchor !== null}
        onOpenChange={(open: boolean): void => {
          if (!open) setCommentAnchor(null)
        }}
      />
    </ContextMenu>
  )
}

// The commit's diff for one file — read-only.
function CommitFileDiff({ hash, filePath }: { hash: string; filePath: string }): React.JSX.Element {
  const diffMode = usePreferencesStore((s) => s.diffMode)
  const { hunks, error } = useCommitDiff(hash, filePath)

  if (error) return <p className="p-4 text-sm text-destructive">{error.message}</p>
  if (hunks === undefined) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="flex h-full flex-col">
      <ContextMenu>
        <ContextMenuTrigger className="block min-h-0 flex-1 select-text">
          <HunksView hunks={hunks} filePath={filePath} diffMode={diffMode} />
        </ContextMenuTrigger>
      </ContextMenu>
    </div>
  )
}

export function CommitView({ hash }: { hash: string }): React.JSX.Element {
  const [selected, setSelected] = useState<string | null>(null)
  const { groups } = useCommitFlow(hash)
  const message = useCommitMessage(hash)
  const repoPath = useHubRepoPath()
  const openTab = useTabsStore((s) => s.openTab)

  if (repoPath === null || groups === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  }

  const allFiles = groups.flatMap((g) => g.files)
  const selectedFile = selected ?? allFiles[0]?.path ?? null
  const selectedStatus = allFiles.find((f) => f.path === selectedFile)?.status

  // Jump from the diff to the whole file (a preview tab, like DiffView's toolbar
  // button). Hidden for a deleted file — it no longer exists on disk.
  const handleOpenFile = (): void => {
    if (!selectedFile) return
    const absolute = `${repoPath}/${selectedFile}`
    openTab(
      targetedTab(
        'file',
        absolute,
        { title: fileName(selectedFile), preview: true },
        activeTabTarget(),
      ),
    )
  }

  // Same continuous stacked-diff surface as Changes — one scroll for every file
  // in this commit, in the same flow order as the list below.
  const handleOpenReviewAll = (): void => {
    const key = changesetTabKey({ type: 'commit', hash })
    const title = (message ?? hash.slice(0, 12)).split('\n')[0]?.trim() || hash.slice(0, 12)
    openTab(targetedTab('changeset', key, { title }, activeTabTarget()))
  }

  return (
    <div data-testid={TestIds.codeWell} className={cn(viewerWellClass, 'flex gap-3')}>
      <div
        data-testid={TestIds.commitListCard}
        className={cn(raisedCardClass, 'flex w-64 shrink-0 flex-col overflow-y-auto')}
      >
        <div className="border-b px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm-minus text-foreground">
              {message ?? '…'}
            </p>
            {allFiles.length > 0 && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="shrink-0 text-muted-foreground"
                      onClick={handleOpenReviewAll}
                      aria-label="All changes"
                    >
                      <Rows3 />
                    </Button>
                  }
                />
                <TooltipContent>All changes</TooltipContent>
              </Tooltip>
            )}
          </div>
          <p className="mt-1 font-mono text-xs-minus text-muted-foreground">{hash.slice(0, 12)}</p>
        </div>
        {groups.map((group) => (
          <div key={group.layer}>
            <p className="flex h-6 items-center px-3 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
              {group.layer}
            </p>
            {group.files.map((file) => (
              <CommitFileRow
                key={file.path}
                file={file}
                repoPath={repoPath}
                selected={file.path === selectedFile}
                onSelect={setSelected}
              />
            ))}
          </div>
        ))}
        {allFiles.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">No files changed</p>
        )}
      </div>
      <div className="min-w-0 min-h-0 flex-1">
        <div
          data-testid={TestIds.codeCard}
          className={cn(raisedCardClass, 'flex h-full min-h-0 flex-col')}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-1">
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
      </div>
    </div>
  )
}
