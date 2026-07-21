import type { ReadingFile } from '@backend/feature-view'
import type { FileSource } from '@backend/review-set'
import { SidebarHeaderActions } from '@renderer/components/shell/sidebar-header-actions'
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
import { Button } from '@renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { useDiffFilePrefetch } from '@renderer/hooks/use-diff'
import { useFeatureReading } from '@renderer/hooks/use-feature-reading'
import { useClearFeatureReview } from '@renderer/hooks/use-feature-view'
import { useReviewedPaths, useToggleReviewed } from '@renderer/hooks/use-reviewed'
import { highlightRangesForFile } from '@renderer/lib/highlight-ranges'
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
  FileDiff,
  MessageSquarePlus,
  MoreHorizontal,
  RefreshCw,
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

// One file row of the outline. Click opens the **diff** for changed files
// (matches Changes — U11); shipped/context open the file with highlights.
// "Open file" / "Open diff" stay on the context menu for the other mode.
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

  const openFile = (): void => {
    const absolute = `${repoPath}/${file.path}`
    const ranges = highlightRangesForFile(file)
    openTab({
      id: tabId('file', absolute),
      kind: 'file',
      title: name,
      path: absolute,
      line: ranges?.[0]?.start,
      highlight: ranges,
    })
  }

  const openDiff = (): void => {
    openTab({ id: tabId('diff', file.path), kind: 'diff', title: name, path: file.path })
  }

  // Changed → diff first (same as Changes list); context/shipped → file + highlights.
  const open = (): void => {
    if (file.source === 'changed') openDiff()
    else openFile()
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
          {file.source === 'changed' ? (
            <ContextMenuItem onClick={openFile}>
              <FileDiff />
              Open file
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onClick={openDiff}>
              <FileDiff />
              Open diff
            </ContextMenuItem>
          )}
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
// above THIS checkout's outline — open the canvas with one button; the list is the
// Execution file outline. Intent / Execution / Evidence tabs live only in the viewer.
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
  const canvasTab = useReviewFocusStore((s) => s.canvasTab)
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
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

  // Open the Review canvas (one tab per repo) and optionally jump to an Intent
  // chapter — FeatureView consumes jumps once mounted. Canvas tabs (Intent /
  // Execution / Evidence) live only in the viewer, not here.
  const openReview = (target?: ReviewJumpTarget): void => {
    openTab({
      id: tabId('feature', repo.path),
      kind: 'feature',
      title: 'Review',
      path: repo.path,
    })
    if (target) requestJump(target)
  }

  // Clear discards the agent's whole Review (files, notes, sections) AND its
  // evidence directory. Confirm via AlertDialog (one clear affordance in …).
  const runClear = async (): Promise<void> => {
    setClearError(null)
    try {
      await clear()
      setConfirmClearOpen(false)
    } catch (e) {
      setClearError(e instanceof Error ? e.message : String(e))
    }
  }

  const allFiles = uniqueFiles([
    ...reading.sections.flatMap((section) => section.files),
    ...reading.groups.flatMap((group) => group.files),
  ])
  const reviewedCount = allFiles.filter((file) => reviewed.has(file.path)).length
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
      {/* Header: name + progress + one open affordance. Clear lives in … menu.
          File list below is the Execution outline (not a second set of canvas tabs). */}
      <div className="mx-2 mt-0.5 flex flex-col gap-2 rounded-lg border bg-card p-2.5">
        <div className="flex items-start gap-1.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">{reading.name}</p>
            <p className="mt-0.5 text-2xs text-muted-foreground">
              {allFiles.length > 0
                ? `${reviewedCount}/${allFiles.length} reviewed`
                : reading.canvas
                  ? 'Freeform Intent'
                  : 'Review'}
            </p>
          </div>
          <SidebarHeaderActions>
            <Button variant="ghost" size="icon-sm" onClick={refresh} aria-label="Refresh review">
              <RefreshCw />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm" aria-label="Review actions">
                    <MoreHorizontal />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  variant="destructive"
                  disabled={isClearing}
                  onClick={() => setConfirmClearOpen(true)}
                >
                  <Eraser />
                  Clear review & evidence
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarHeaderActions>
        </div>
        <Button
          size="sm"
          className="h-7 w-full text-xs"
          onClick={() => openReview({ kind: 'intent' })}
        >
          Open Review
        </Button>
      </div>

      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear review and evidence?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes the agent Review (Intent, files, walkthrough) and the evidence directory for
              this repo. The agent can re-publish. This cannot be undone from the app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isClearing}
              onClick={() => void runClear()}
              aria-label="Confirm clear review and evidence"
            >
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {clearError && (
        <p className="mx-2 whitespace-pre-wrap font-mono text-2xs text-destructive">{clearError}</p>
      )}

      <div className="flex flex-col gap-0.5 px-2 pt-1">
        {sectionEntries.map(({ section, index, key }) => (
          <div key={key}>
            <ChapterButton
              label={section.title}
              active={canvasTab === 'intent' && isActive(index)}
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
              <div className="px-2 pb-0.5 pt-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                More files
              </div>
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
