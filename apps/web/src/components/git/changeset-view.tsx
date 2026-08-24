import type { ReadingFile } from '@porcelain/contracts/review'
import { Button } from '@renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import {
  type DiffReadingScope,
  useDiffReading,
  useReviewedPaths,
  useToggleReviewed,
} from '@renderer/features/git'
import { useCommentIndex } from '@renderer/features/review'
import {
  addRange,
  allRevealed,
  collapseHunks,
  DEFAULT_DIFF_CONTEXT,
  type DiffGap,
  type LineRange,
  revealDown,
  revealUp,
  revealWhole,
} from '@renderer/lib/collapse-hunks'
import { raisedCardClass, viewerWellClass } from '@renderer/lib/controls'
import { type LineSelection, lineSelectionForFile } from '@renderer/lib/line-selection'
import { fileName } from '@renderer/lib/paths'
import { cn } from '@renderer/lib/utils'
import { activeTabTarget, targetedTab } from '@renderer/stores/hub-tabs'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useRevealStore } from '@renderer/stores/reveal'
import { useTabsStore } from '@renderer/stores/tabs'
import { TestIds } from '@shared/test-ids'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  FoldVertical,
  MessageSquarePlus,
  Square,
  SquareCheck,
  UnfoldVertical,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { type CommentAnchor, CommentComposer } from './comment-composer'
import { HunksView } from './hunks-view'

/**
 * Encode a review scope into the tab's path key (and parse it back).
 *
 * The Branch scope carries its comparison base, so two bases open as two tabs
 * rather than one tab whose contents silently change under a restored session.
 * A bare `branch` (older sessions, and the default pick) still parses.
 */
export function changesetTabKey(scope: DiffReadingScope): string {
  if (scope.type === 'commit') return `commit:${scope.hash}`
  if (scope.type === 'branch' && scope.base !== undefined) return `branch:${scope.base}`
  return scope.type
}

export function parseChangesetTabKey(path: string): DiffReadingScope {
  if (path === 'working') return { type: 'working' }
  if (path === 'branch') return { type: 'branch' }
  if (path.startsWith('branch:')) return { type: 'branch', base: path.slice('branch:'.length) }
  if (path.startsWith('commit:')) return { type: 'commit', hash: path.slice('commit:'.length) }
  // Defensive fallback — malformed navigation should not blank the view.
  return { type: 'working' }
}

function pendingLinesFor(
  anchor: CommentAnchor | null,
  path: string,
): ReadonlySet<number> | undefined {
  if (!anchor || anchor.path !== path || anchor.startLine === undefined) return undefined
  const lines = new Set<number>()
  const end = anchor.endLine ?? anchor.startLine
  for (let line = anchor.startLine; line <= end; line++) lines.add(line)
  return lines
}

function ChangesetFileCard({
  file,
  reviewable,
  commentAnchor,
  onComment,
}: {
  file: ReadingFile
  reviewable: boolean
  commentAnchor: CommentAnchor | null
  onComment: (anchor: CommentAnchor) => void
}): React.JSX.Element {
  const [fileCollapsed, setFileCollapsed] = useState(false)
  const [lineSel, setLineSel] = useState<LineSelection | null>(null)
  const project = useProjectSelectionStore((s) => s.project)
  const openTab = useTabsStore((s) => s.openTab)
  const setSidebarTab = usePreferencesStore((s) => s.setSidebarTab)
  const reveal = useRevealStore((s) => s.reveal)
  const reviewed = useReviewedPaths()
  const { mark, unmark } = useToggleReviewed()
  const commentIndex = useCommentIndex(file.path)
  const isReviewed = reviewed.has(file.path)
  const canOpenFile = file.status !== 'deleted'
  const pendingLines = useMemo(
    () => pendingLinesFor(commentAnchor, file.path),
    [commentAnchor, file.path],
  )
  const [revealed, setRevealed] = useState<readonly LineRange[]>([])
  const collapsedDiff = useMemo(
    () => collapseHunks(file.hunks ?? [], { context: DEFAULT_DIFF_CONTEXT, revealed }),
    [file.hunks, revealed],
  )
  const canExpand = collapsedDiff.gaps.some((gap) => gap.expandable)
  const useCollapsed = canExpand || revealed.length > 0
  const handleExpand = (gap: DiffGap, direction: 'up' | 'down' | 'whole'): void => {
    const range =
      direction === 'up' ? revealUp(gap) : direction === 'down' ? revealDown(gap) : revealWhole(gap)
    setRevealed((current) => addRange(current, range))
  }

  const handleOpenFile = (): void => {
    if (!project || !canOpenFile) return
    const absolute = `${project.path}/${file.path}`
    openTab(
      targetedTab(
        'file',
        absolute,
        { title: fileName(file.path), preview: true },
        activeTabTarget(),
      ),
    )
    setSidebarTab('files')
    reveal(absolute)
  }

  const handleToggleReviewed = (): void => {
    if (isReviewed) {
      unmark(file.path)
      return
    }
    mark(file.path)
    setFileCollapsed(true)
  }

  return (
    <div
      data-testid={TestIds.changesetCard(file.path)}
      className={cn(raisedCardClass, 'flex flex-col')}
    >
      <div className="flex h-9 shrink-0 items-center gap-2 border-b px-3">
        <Button
          variant="ghost"
          size="icon-2xs"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => setFileCollapsed((current) => !current)}
          aria-expanded={!fileCollapsed}
          aria-label={fileCollapsed ? 'Expand diff' : 'Collapse diff'}
          data-testid={TestIds.diffCollapse(file.path)}
        >
          {fileCollapsed ? <ChevronRight /> : <ChevronDown />}
        </Button>
        <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium">{file.path}</span>
        {file.additions ? (
          <span className="font-mono text-2xs text-success">+{file.additions}</span>
        ) : null}
        {file.deletions ? (
          <span className="font-mono text-2xs text-destructive">−{file.deletions}</span>
        ) : null}
        {reviewable && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-2xs"
                  onClick={handleToggleReviewed}
                  className={cn(
                    'shrink-0',
                    isReviewed ? 'text-success' : 'text-muted-foreground hover:text-foreground',
                  )}
                  aria-label={isReviewed ? 'Unmark reviewed' : 'Mark reviewed'}
                  data-testid={TestIds.diffReviewed(file.path)}
                >
                  {isReviewed ? (
                    <SquareCheck className="size-3.5" />
                  ) : (
                    <Square className="size-3.5" />
                  )}
                </Button>
              }
            />
            <TooltipContent>{isReviewed ? 'Unmark reviewed' : 'Mark reviewed'}</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-2xs"
                onClick={() => onComment({ path: file.path })}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Comment on file"
              >
                <MessageSquarePlus className="size-3.5" />
              </Button>
            }
          />
          <TooltipContent>Comment on file</TooltipContent>
        </Tooltip>
        {canOpenFile && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-2xs"
                  onClick={handleOpenFile}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Open file"
                >
                  <FileText className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent>Open file</TooltipContent>
          </Tooltip>
        )}
        {canExpand && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-2xs"
                  onClick={() => setRevealed(allRevealed())}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Expand all context"
                >
                  <UnfoldVertical className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent>Expand all context</TooltipContent>
          </Tooltip>
        )}
        {revealed.length > 0 && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-2xs"
                  onClick={() => setRevealed([])}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Collapse context"
                >
                  <FoldVertical className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent>Collapse context</TooltipContent>
          </Tooltip>
        )}
      </div>
      {!fileCollapsed && file.hunks && file.hunks.length > 0 && (
        <ContextMenu
          onOpenChange={(open: boolean): void => {
            if (!open) setLineSel(null)
          }}
        >
          <ContextMenuTrigger
            className="block select-text"
            onContextMenu={(event: React.MouseEvent): void => {
              const selected = lineSelectionForFile(file.path)
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
              hunks={useCollapsed ? collapsedDiff.hunks : (file.hunks ?? [])}
              gaps={useCollapsed ? collapsedDiff.gaps : undefined}
              onExpand={useCollapsed ? handleExpand : undefined}
              filePath={file.path}
              diffMode="unified"
              layout="content"
              commentIndex={commentIndex}
              pendingLines={pendingLines}
            />
          </ContextMenuTrigger>
          <ContextMenuContent className="w-52">
            {lineSel ? (
              <ContextMenuItem
                onClick={() =>
                  onComment({
                    path: file.path,
                    startLine: lineSel.startLine,
                    endLine: lineSel.endLine,
                    anchorText: lineSel.text.slice(0, 2000),
                  })
                }
              >
                <MessageSquarePlus /> Add comment
              </ContextMenuItem>
            ) : (
              <ContextMenuItem onClick={() => onComment({ path: file.path })}>
                <MessageSquarePlus /> Comment on file
              </ContextMenuItem>
            )}
            {reviewable && (
              <ContextMenuItem onClick={handleToggleReviewed}>
                {isReviewed ? <Square /> : <SquareCheck />}
                {isReviewed ? 'Unmark reviewed' : 'Mark reviewed'}
              </ContextMenuItem>
            )}
          </ContextMenuContent>
        </ContextMenu>
      )}
    </div>
  )
}

/**
 * Stacked-diff reading surface opened from Changes or History. Each file is its
 * own raised card; collapsed cards are header-only.
 */
export function ChangesetView({ path }: { path: string }): React.JSX.Element {
  const scope = parseChangesetTabKey(path)
  const { reading, error } = useDiffReading(scope)
  const [commentAnchor, setCommentAnchor] = useState<CommentAnchor | null>(null)

  if (error) return <p className="p-4 text-sm text-destructive">{error.message}</p>
  if (reading === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  }

  const files = reading.groups.flatMap((group) => group.files)
  if (files.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <p className="text-sm font-medium text-foreground">
            {scope.type === 'commit' ? 'Empty commit' : 'No changes to review'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {scope.type === 'commit'
              ? 'This commit doesn’t touch any files.'
              : 'Nothing to walk through in this range yet.'}
          </p>
        </div>
      </div>
    )
  }

  const scopeLabel =
    scope.type === 'working'
      ? 'Working tree'
      : scope.type === 'branch'
        ? 'Branch range'
        : `Commit ${scope.hash.slice(0, 7)}`

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-4 py-2 text-2xs text-muted-foreground">
        <span className="font-medium text-foreground">All changes</span>
        <span className="text-muted-foreground/40">·</span>
        <span>{scopeLabel}</span>
        <span className="text-muted-foreground/40">·</span>
        <span className="tabular-nums">
          {files.length} file{files.length === 1 ? '' : 's'}
        </span>
      </div>
      <div data-testid={TestIds.codeWell} className={cn(viewerWellClass, 'overflow-auto')}>
        <div className="flex flex-col gap-3">
          {files.map((file) => (
            <ChangesetFileCard
              key={file.path}
              file={file}
              reviewable={scope.type !== 'commit'}
              commentAnchor={commentAnchor}
              onComment={setCommentAnchor}
            />
          ))}
        </div>
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
