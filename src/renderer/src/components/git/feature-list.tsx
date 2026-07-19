import type { ReadingFile } from '@backend/feature-view'
import type { FileSource } from '@backend/review-set'
import { SidebarHeaderActions } from '@renderer/components/shell/sidebar-header-actions'
import { Button } from '@renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useDiffFilePrefetch } from '@renderer/hooks/use-diff'
import { useFeatureReading } from '@renderer/hooks/use-feature-reading'
import { useClearFeatureReview } from '@renderer/hooks/use-feature-view'
import { useReviewedPaths, useToggleReviewed } from '@renderer/hooks/use-reviewed'
import { dirName, fileName } from '@renderer/lib/paths'
import { cn } from '@renderer/lib/utils'
import { useRepoStore } from '@renderer/stores/repo'
import {
  type ReviewFocusSection,
  type ReviewJumpTarget,
  useReviewFocusStore,
} from '@renderer/stores/review-focus'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import {
  Check,
  Eraser,
  MessageSquarePlus,
  RefreshCw,
  ShieldCheck,
  Square,
  SquareCheck,
} from 'lucide-react'
import { memo, useState } from 'react'
import { CommentComposer } from './comment-composer'
import { ReviewInbox } from './review-inbox'

// The legend marker for a file's source: a filled dot for a changed file, a
// rotated square for an agent-shipped cross-seam file, a hollow ring for the
// unchanged context the change reaches.
export function SourceMarker({ source }: { source: FileSource }): React.JSX.Element {
  if (source === 'changed') return <span className="size-2 shrink-0 rounded-full bg-primary" />
  if (source === 'shipped') return <span className="size-[7px] shrink-0 rotate-45 bg-info" />
  return <span className="size-2 shrink-0 rounded-full border border-muted-foreground/70" />
}

// One file row of the outline, anchored under its section (or a "More files"
// group). Same behaviors as the old flow timeline node: click opens the
// working-tree diff for a changed file (relative path, like the Changes list) or
// the file itself otherwise (absolute path, like the file tree); right-click
// marks/unmarks reviewed or starts a file comment.
function OutlineFileRowImpl({
  file,
  repoPath,
  isReviewed,
  onComment,
}: {
  file: ReadingFile
  repoPath: string
  isReviewed: boolean
  onComment: (path: string) => void
}): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const prefetchDiff = useDiffFilePrefetch()
  const { mark, unmark } = useToggleReviewed()
  const name = fileName(file.path)
  const dir = dirName(file.path)

  const open = (): void => {
    if (file.source === 'changed') {
      openTab({ id: tabId('diff', file.path), kind: 'diff', title: name, path: file.path })
    } else {
      const absolute = `${repoPath}/${file.path}`
      openTab({ id: tabId('file', absolute), kind: 'file', title: name, path: absolute })
    }
  }

  return (
    <div className="relative pl-6">
      <span className="absolute left-[3px] top-2.5 z-10 flex">
        <SourceMarker source={file.source} />
      </span>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <button
              type="button"
              onClick={open}
              onMouseEnter={() => {
                if (file.source === 'changed') prefetchDiff(file.path)
              }}
              className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1 text-left hover:bg-sidebar-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          }
        >
          <span className="flex max-w-full items-center gap-1.5">
            {isReviewed && (
              <Check className="size-3 shrink-0 self-center text-success" aria-label="Reviewed" />
            )}
            <span
              className={cn(
                'truncate font-mono text-sm-minus',
                (file.source !== 'changed' || isReviewed) && 'text-muted-foreground',
                isReviewed && 'line-through',
              )}
            >
              {name}
            </span>
            {file.additions !== undefined && file.additions > 0 && (
              <span className="shrink-0 font-mono text-2xs text-success">+{file.additions}</span>
            )}
            {file.deletions !== undefined && file.deletions > 0 && (
              <span className="shrink-0 font-mono text-2xs text-destructive">
                −{file.deletions}
              </span>
            )}
          </span>
          {dir && (
            <span className="max-w-full truncate font-mono text-xs text-muted-foreground" dir="rtl">
              {dir}
            </span>
          )}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          {isReviewed ? (
            <ContextMenuItem onClick={async () => unmark(file.path)}>
              <Square />
              Unmark reviewed
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onClick={async () => mark(file.path)}>
              <SquareCheck />
              Mark reviewed
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={() => onComment(file.path)}>
            <MessageSquarePlus /> Comment on file
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {file.note && (
        <div className="mx-2 mb-1 rounded-lg border border-border/60 bg-muted px-2.5 py-2">
          <span className="text-3xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Note
          </span>
          <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
            {file.note}
          </p>
        </div>
      )}
    </div>
  )
}

const OutlineFileRow = memo(OutlineFileRowImpl)

// A chapter title in the outline: click jumps the open Review document there
// (opening it first if needed). Highlighted while it's the topmost visible chapter.
function ChapterButton({
  label,
  active,
  onJump,
}: {
  label: string
  active: boolean
  onJump: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onJump}
      className={cn(
        'w-full truncate rounded-md px-2 py-1 text-left text-sm-minus font-medium hover:bg-sidebar-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        active ? 'bg-sidebar-accent/50 text-foreground' : 'text-muted-foreground',
      )}
    >
      {label}
    </button>
  )
}

/** A section's files, deduped by path (a file anchored twice reads once in the outline). */
function uniqueFiles(files: readonly ReadingFile[]): ReadingFile[] {
  const seen = new Set<string>()
  return files.filter((file) => {
    if (seen.has(file.path)) return false
    seen.add(file.path)
    return true
  })
}

// The Feature sidebar tab: the Review inbox (cross-worktree work awaiting review)
// above the OUTLINE of THIS checkout's Review document — chapter titles that jump
// the open Review, each section's anchored files, the unanchored "More files", and
// the loop-evidence chapter. The viewer's `feature` tab is the document; this is the
// index you scan, click, and tick reviewed from.
export function FeatureList(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <ReviewInbox />
      <FeatureOutline />
    </div>
  )
}

// The outline of this checkout's own Review — the inbox above is rendered by FeatureList
// so it shows in every state (loading, no-review, and full outline) of the outline below.
function FeatureOutline(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const openTab = useTabsStore((s) => s.openTab)
  const { reading, refresh } = useFeatureReading()
  const reviewed = useReviewedPaths()
  const { clear, isClearing } = useClearFeatureReview()
  const requestJump = useReviewFocusStore((s) => s.requestJump)
  const activeSection = useReviewFocusStore((s) => s.activeSection)
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)
  const [commentPath, setCommentPath] = useState<string | null>(null)

  if (!repo || reading === undefined) {
    return <p className="p-3 text-sm text-muted-foreground">Loading…</p>
  }

  // No agent review set → no Review at all. The viewer's empty state carries the
  // copy-a-prompt affordance; the outline stays a one-liner.
  if (reading === null) {
    return (
      <p className="px-3 py-2 text-sm text-muted-foreground">
        No review yet. The outline fills in when your agent publishes the Review via the porcelain
        CLI.
      </p>
    )
  }

  // Open the Review document (pinned place: one tab per repo) and optionally jump
  // it to a chapter — the reading surface consumes the jump once mounted.
  const openReview = (target?: ReviewJumpTarget): void => {
    openTab({
      id: tabId('feature', repo.path),
      kind: 'feature',
      title: 'Review',
      path: repo.path,
    })
    if (target) requestJump(target)
  }

  // Clear discards the agent's whole Review (files, notes, sections), so it's
  // two-step: the first click arms it, the second confirms. The agent can always
  // re-push, and blurring the button cancels.
  const handleClear = async (): Promise<void> => {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    setClearError(null)
    try {
      await clear()
    } catch (e) {
      setClearError(e instanceof Error ? e.message : String(e))
    } finally {
      setConfirmClear(false)
    }
  }

  const allFiles = uniqueFiles([
    ...reading.sections.flatMap((section) => section.files),
    ...reading.groups.flatMap((group) => group.files),
  ])
  const reviewedCount = allFiles.filter((file) => reviewed.has(file.path)).length
  const moreFilesIndex = reading.sections.length
  const isActive = (section: ReviewFocusSection): boolean => activeSection === section

  // Stable list keys from the agent-authored titles (deduped — two sections may
  // share a title; the whole list is replaced on every push, so title#n is stable
  // enough and avoids keying on the index).
  const seenTitles = new Map<string, number>()
  const sectionEntries = reading.sections.map((section, index) => {
    const n = (seenTitles.get(section.title) ?? 0) + 1
    seenTitles.set(section.title, n)
    return { section, index, key: n === 1 ? section.title : `${section.title}#${n}` }
  })

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-1.5 px-2">
        {/* The title is the agent's own name for the Review; clicking it opens the
            document. It wraps to multiple lines rather than truncating. */}
        <button
          type="button"
          onClick={() => openReview()}
          className="min-w-0 pt-1 text-left text-xs font-medium hover:text-foreground/80"
        >
          {reading.name}
        </button>
        <SidebarHeaderActions>
          <Button variant="ghost" size="icon-sm" onClick={refresh} aria-label="Refresh review">
            <RefreshCw />
          </Button>
        </SidebarHeaderActions>
      </div>

      {/* Progress + the destructive clear: two-step (arm then confirm — the confirm
          flips it to the destructive variant), and blurring the button disarms. */}
      <div className="flex items-center justify-between gap-2 px-2">
        <p className="text-2xs text-muted-foreground">
          {allFiles.length > 0 ? `${reviewedCount}/${allFiles.length} reviewed` : ''}
        </p>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-xs"
                variant={confirmClear ? 'destructive' : 'ghost'}
                className="text-muted-foreground"
                onClick={handleClear}
                onBlur={() => setConfirmClear(false)}
                disabled={isClearing}
                aria-label={
                  confirmClear ? 'Confirm clear agent review set' : 'Clear agent review set'
                }
              >
                <Eraser />
              </Button>
            }
          />
          <TooltipContent>
            Removes the agent's Review — files, notes, and walkthrough sections.
          </TooltipContent>
        </Tooltip>
      </div>

      {clearError && (
        <p className="mx-2 whitespace-pre-wrap font-mono text-2xs text-destructive">{clearError}</p>
      )}

      <div className="flex flex-col gap-0.5 px-2 pt-1">
        {sectionEntries.map(({ section, index, key }) => (
          <div key={key}>
            <ChapterButton
              label={section.title}
              active={isActive(index)}
              onJump={() => openReview({ kind: 'section', index })}
            />
            {uniqueFiles(section.files).map((file) => (
              <OutlineFileRow
                key={file.path}
                file={file}
                repoPath={repo.path}
                isReviewed={reviewed.has(file.path)}
                onComment={setCommentPath}
              />
            ))}
          </div>
        ))}

        {reading.groups.length > 0 && (
          <div>
            {reading.sections.length > 0 && (
              <ChapterButton
                label="More files"
                active={isActive(moreFilesIndex)}
                onJump={() => openReview({ kind: 'section', index: moreFilesIndex })}
              />
            )}
            {reading.groups.map((group) => (
              <div key={group.layer}>
                <div className="px-2 pb-0.5 pt-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  {group.layer}
                </div>
                {group.files.map((file) => (
                  <OutlineFileRow
                    key={file.path}
                    file={file}
                    repoPath={repo.path}
                    isReviewed={reviewed.has(file.path)}
                    onComment={setCommentPath}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {reading.evidence && (
          <button
            type="button"
            onClick={() => openReview({ kind: 'evidence' })}
            className={cn(
              'flex w-full items-center gap-1.5 truncate rounded-md px-2 py-1 text-left text-sm-minus font-medium hover:bg-sidebar-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              isActive('evidence')
                ? 'bg-sidebar-accent/50 text-foreground'
                : 'text-muted-foreground',
            )}
          >
            <ShieldCheck className="size-3.5 shrink-0 text-info" />
            <span className="truncate">Loop evidence</span>
          </button>
        )}
      </div>

      {allFiles.length === 0 && reading.sections.length === 0 && (
        <p className="px-3 py-2 text-sm text-muted-foreground">
          The Review is empty — the agent published a name but no files or sections yet.
        </p>
      )}

      <CommentComposer
        anchor={commentPath ? { path: commentPath } : null}
        open={commentPath !== null}
        onOpenChange={(open) => {
          if (!open) setCommentPath(null)
        }}
      />
    </div>
  )
}
