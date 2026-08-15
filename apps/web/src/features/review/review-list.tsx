import type { FileSource, ReadingFile } from '@porcelain/contracts/review'
import { CommentComposer } from '@renderer/components/git/comment-composer'
import { FileCommentButton } from '@renderer/components/git/file-comment-button'
import { Button } from '@renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import {
  useDiffFileHoverPrefetch,
  useReviewedPaths,
  useToggleReviewed,
} from '@renderer/features/git'
import { compactButtonClass } from '@renderer/lib/controls'
import { highlightRangesForFile } from '@renderer/lib/highlight-ranges'
import { dirName, fileName } from '@renderer/lib/paths'
import { reviewOutlineFiles } from '@renderer/lib/review-lifecycle'
import { cn } from '@renderer/lib/utils'
import { targetedTab } from '@renderer/stores/hub-tabs'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useTabsStore } from '@renderer/stores/tabs'
import { TestIds } from '@shared/test-ids'
import { Check, FileDiff, MessageSquarePlus, Square, SquareCheck } from 'lucide-react'
import { memo, useState } from 'react'
import {
  type ReviewFocusSection,
  type ReviewJumpTarget,
  useReviewFocusStore,
} from './review-focus-store'
import { ReviewInbox } from './review-inbox'
import { useReviewReading } from './review-queries'

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
  const prefetchDiff = useDiffFileHoverPrefetch()
  const { mark, unmark } = useToggleReviewed()
  const name = fileName(file.path)
  const dir = dirName(file.path)

  const handleOpenFile = (): void => {
    const absolute = `${repoPath}/${file.path}`
    const ranges = highlightRangesForFile(file)
    openTab(
      targetedTab('file', absolute, {
        title: name,
        line: ranges?.[0]?.start,
        highlight: ranges,
      }),
    )
  }

  const handleOpenDiff = (): void => {
    openTab(targetedTab('diff', file.path, { title: name }))
  }

  // Changed → diff first (same as Changes list); context/shipped → file + highlights.
  const handleOpen = (): void => {
    if (file.source === 'changed') handleOpenDiff()
    else handleOpenFile()
  }

  return (
    <div className="relative pl-6">
      <span className="absolute left-[3px] top-2.5 z-10 flex">
        <SourceMarker source={file.source} />
      </span>
      <ContextMenu>
        <div className="relative">
          <ContextMenuTrigger
            render={
              <button
                type="button"
                onClick={handleOpen}
                onMouseEnter={() => {
                  if (file.source === 'changed') prefetchDiff(file.path)
                }}
                className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1 pr-8 text-left hover:bg-sidebar-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
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
              <span
                className="max-w-full truncate font-mono text-xs text-muted-foreground"
                dir="rtl"
              >
                {dir}
              </span>
            )}
          </ContextMenuTrigger>
          <FileCommentButton path={file.path} />
        </div>
        <ContextMenuContent className="w-48">
          {file.source === 'changed' ? (
            <ContextMenuItem onClick={handleOpenFile}>
              <FileDiff />
              Open file
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onClick={handleOpenDiff}>
              <FileDiff />
              Open diff
            </ContextMenuItem>
          )}
          {isReviewed ? (
            <ContextMenuItem onClick={() => unmark(file.path)}>
              <Square />
              Unmark reviewed
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onClick={() => mark(file.path)}>
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

// The Review sidebar tab: the Review inbox (cross-worktree work awaiting review)
// above THIS checkout's outline — open the canvas with one button; the list is the
// Execution file outline. Intent / Execution / Evidence tabs live only in the viewer.
export function ReviewList(): React.JSX.Element {
  return (
    <div data-testid={TestIds.reviewList} className="flex flex-col gap-1 pt-2">
      <ReviewInbox />
      <ReviewOutline />
    </div>
  )
}

// The outline of this checkout's own Review — the inbox above is rendered by ReviewList
// so it shows in every state (loading, no-review, and full outline) of the outline below.
function ReviewOutline(): React.JSX.Element {
  const project = useProjectSelectionStore((s) => s.project)
  const openTab = useTabsStore((s) => s.openTab)
  // activeReview / reading poll + agent channel events — no manual refresh.
  const { reading } = useReviewReading()
  const reviewed = useReviewedPaths()
  const requestJump = useReviewFocusStore((s) => s.requestJump)
  const activeSection = useReviewFocusStore((s) => s.activeSection)
  const canvasTab = useReviewFocusStore((s) => s.canvasTab)
  const [commentPath, setCommentPath] = useState<string | null>(null)

  if (!project || reading === undefined) {
    return <p className="p-3 text-sm text-muted-foreground">Loading…</p>
  }

  // No agent review set → start-of-unit. The agent opens the unit; the outline
  // points agents (and humans) at Intent-first publish.
  if (reading === null) {
    return (
      <div className="mx-2 mt-0.5 rounded-lg border border-dashed bg-muted/20 p-2.5">
        <p className="text-xs font-medium text-foreground">Start a Review</p>
        <p className="mt-1 text-2xs text-muted-foreground">
          Ask your agent to publish Intent first (name + thesis). Clear any previous unit first.
          Outline fills when Intent is published.
        </p>
      </div>
    )
  }

  // Open the Review canvas (one tab per project) and optionally jump to an Intent
  // chapter — ActiveReview consumes jumps once mounted. Canvas tabs (Intent /
  // Execution / Evidence) live only in the viewer, not here.
  const handleOpenReview = (target?: ReviewJumpTarget): void => {
    openTab(targetedTab('review', project.path, { title: 'Review' }))
    if (target) requestJump(target)
  }

  const allFiles = reviewOutlineFiles(reading)
  const reviewedCount = allFiles.filter((file) => reviewed.has(file.path)).length
  // Ship handoff (U12): committing lives on Changes, its canonical home. The
  // outline reports reading progress and stops there — no second commit entry point.
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
      {/* Header: name + progress + open affordance. Clear review lives on the
          right sidebar (ReviewGroup) as an inline button — it was the only … menu
          item. File list below is the Execution outline (not canvas tabs). */}
      <div className="mx-2 mt-0.5 flex flex-col gap-2 rounded-lg border bg-card p-2.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">{reading.name}</p>
          <p className="mt-0.5 text-2xs text-muted-foreground">
            {allFiles.length > 0
              ? `${reviewedCount}/${allFiles.length} reviewed`
              : 'Intent published — previous unit still up'}
          </p>
        </div>
        <Button
          size="sm"
          className={cn(compactButtonClass, 'w-full')}
          data-testid={TestIds.reviewOpen}
          onClick={() => handleOpenReview({ kind: 'intent' })}
        >
          Open Review
        </Button>
      </div>

      <div className="flex flex-col gap-0.5 px-2 pt-1">
        {sectionEntries.map(({ section, index, key }) => (
          <div key={key}>
            <ChapterButton
              label={section.title}
              active={canvasTab === 'intent' && isActive(index)}
              onJump={() => handleOpenReview({ kind: 'section', index })}
            />
            {uniqueFiles(section.files).map((file) => (
              <OutlineFileRow
                key={file.path}
                file={file}
                repoPath={project.path}
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
                    repoPath={project.path}
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
        onOpenChange={(open: boolean): void => {
          if (!open) setCommentPath(null)
        }}
      />
    </div>
  )
}
