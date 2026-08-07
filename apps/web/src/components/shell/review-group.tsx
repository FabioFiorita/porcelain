import type { FeatureReading } from '@backend/review/feature-view'
import { PublishReviewButton } from '@renderer/components/shell/publish-review-button'
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
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from '@renderer/components/ui/sidebar'
import { useReviewComments } from '@renderer/hooks/use-comments'
import { useFeatureReading } from '@renderer/hooks/use-feature-reading'
import {
  useArchivedReviewActions,
  useArchivedReviews,
  useClearFeatureReview,
} from '@renderer/hooks/use-feature-view'
import { useReviewedPaths } from '@renderer/hooks/use-reviewed'
import { rowActionClass } from '@renderer/lib/controls'
import { reviewOutlineFiles } from '@renderer/lib/review-lifecycle'
import { openFeatureReview } from '@renderer/lib/surface-handoffs'
import { cn } from '@renderer/lib/utils'
import { type ReviewFocusSection, useReviewFocusStore } from '@renderer/stores/review-focus'
import { TestIds } from '@shared/test-ids'
import { Archive, Trash2 } from 'lucide-react'
import { useState } from 'react'

const LABEL_CLASS = 'px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground'

/** The first non-empty prose line, stripped of a leading markdown heading marker. */
export function firstProseLine(prose: string): string | null {
  const line = prose
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l !== '')
  if (!line) return null
  return line.replace(/^#+\s*/, '')
}

function chapterTitle(reading: FeatureReading, active: ReviewFocusSection): string {
  if (active === 'evidence') return reading.evidence?.title ?? 'Evidence'
  if (active !== null && active < reading.sections.length) {
    return reading.sections[active]?.title ?? reading.name
  }
  if (active !== null && active === reading.sections.length && reading.sections.length > 0) {
    return 'More files'
  }
  return reading.name
}

function formatArchivedAt(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

/**
 * Feature tab companion: current unit status, archive (clear), and previous
 * reviews restored from `<repo>/.porcelain/reviews/`.
 */
export function ReviewGroup(): React.JSX.Element | null {
  const { reading } = useFeatureReading()
  const activeSection = useReviewFocusStore((s) => s.activeSection)
  const comments = useReviewComments()
  const reviewed = useReviewedPaths()
  const { clear, isClearing } = useClearFeatureReview()
  const archived = useArchivedReviews()
  const { restore, remove, isBusy } = useArchivedReviewActions()
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)

  const handleRunClear = async (): Promise<void> => {
    setClearError(null)
    try {
      await clear()
      setConfirmClearOpen(false)
    } catch (e) {
      setClearError(e instanceof Error ? e.message : String(e))
    }
  }

  // Always rendered — the section is where archived units land, so it has to be
  // visible before the first one does.
  const previousList = (
    <SidebarGroup className="px-3" data-testid={TestIds.previousReviews}>
      <SidebarGroupLabel className={LABEL_CLASS}>Previous reviews</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-1 px-1">
        {archived.length === 0 && (
          <p className="text-2xs text-muted-foreground">
            No previous reviews yet — archived units land here.
          </p>
        )}
        {archived.map((row) => (
          <div
            key={row.id}
            data-testid={TestIds.previousReviewRow(row.id)}
            className="flex items-start gap-1 rounded-xl border bg-card p-2"
          >
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              data-testid={TestIds.previousReviewRestore(row.id)}
              disabled={isBusy}
              onClick={async () => {
                setArchiveError(null)
                try {
                  await restore(row.id)
                  openFeatureReview()
                } catch (e) {
                  setArchiveError(e instanceof Error ? e.message : String(e))
                }
              }}
            >
              <span className="block truncate text-xs font-medium">{row.name}</span>
              <span className="mt-0.5 block text-3xs text-muted-foreground">
                {formatArchivedAt(row.archivedAt)}
              </span>
              {row.thesis && (
                <p className="mt-1 line-clamp-2 text-2xs text-muted-foreground">{row.thesis}</p>
              )}
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              data-testid={TestIds.previousReviewDelete(row.id)}
              disabled={isBusy}
              aria-label={`Delete archived review ${row.name}`}
              onClick={async () => {
                setArchiveError(null)
                try {
                  await remove(row.id)
                } catch (e) {
                  setArchiveError(e instanceof Error ? e.message : String(e))
                }
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
        {archiveError && (
          <p className="whitespace-pre-wrap font-mono text-2xs text-destructive">{archiveError}</p>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )

  // Empty Review: companion matches the viewer start-of-unit empty state.
  if (reading === null) {
    return (
      <>
        <SidebarGroup className="px-3">
          <SidebarGroupLabel className={LABEL_CLASS}>Review</SidebarGroupLabel>
          <SidebarGroupContent className="px-1">
            <div className="rounded-xl border border-dashed bg-muted/20 p-2.5 text-2xs text-muted-foreground">
              Start a unit: ask your agent to publish Intent first (name + thesis). Agents use
              porcelain-companion. Archive the previous unit when done so it stays in Previous
              reviews (`.porcelain/reviews/`).
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
        {previousList}
      </>
    )
  }

  if (!reading) return null

  const outline = reviewOutlineFiles(reading)
  const reviewedCount = outline.filter((f) => reviewed.has(f.path)).length

  const section =
    typeof activeSection === 'number' && activeSection < reading.sections.length
      ? reading.sections[activeSection]
      : undefined
  const proseLine = section ? firstProseLine(section.prose) : null
  const openCommentCount = comments.filter((c) => !c.resolved).length

  return (
    <>
      <SidebarGroup className="px-3">
        <SidebarGroupLabel className={LABEL_CLASS}>Current review</SidebarGroupLabel>
        <SidebarGroupContent className="flex flex-col gap-1.5 px-1">
          <div className="rounded-xl border bg-card p-2">
            <div className="min-w-0">
              <span className="block truncate text-xs font-medium">{reading.name}</span>
              {outline.length > 0 && (
                <span className="mt-0.5 block text-3xs text-muted-foreground">
                  {reviewedCount}/{outline.length} reviewed
                </span>
              )}
            </div>
            {proseLine && (
              <p className="mt-1 line-clamp-2 text-xs-minus text-muted-foreground">
                {chapterTitle(reading, activeSection)}
                {proseLine ? ` — ${proseLine}` : ''}
              </p>
            )}
            {openCommentCount > 0 && (
              <p className="mt-1 text-2xs text-muted-foreground/70">
                {openCommentCount} open comment{openCommentCount === 1 ? '' : 's'}
              </p>
            )}
          </div>
          <PublishReviewButton className={rowActionClass} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(rowActionClass, 'w-full justify-start text-destructive')}
            disabled={isClearing}
            data-testid={TestIds.featureClearReview}
            onClick={() => setConfirmClearOpen(true)}
          >
            <Archive />
            Archive review & evidence
          </Button>
          {clearError && (
            <p className="whitespace-pre-wrap font-mono text-2xs text-destructive">{clearError}</p>
          )}
        </SidebarGroupContent>

        <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive review and evidence?</AlertDialogTitle>
              <AlertDialogDescription>
                Moves the agent Review (Intent, files, walkthrough), comments, and evidence into
                `.porcelain/reviews/` so you can restore later. The active unit becomes empty until
                the agent re-publishes or you restore a previous review.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={isClearing}
                onClick={async () => {
                  await handleRunClear()
                }}
                aria-label="Confirm archive review and evidence"
              >
                Archive
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarGroup>
      {previousList}
    </>
  )
}
