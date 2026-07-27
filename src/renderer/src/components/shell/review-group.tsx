import type { FeatureReading } from '@backend/feature-view'
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
import { useClearFeatureReview } from '@renderer/hooks/use-feature-view'
import { rowActionClass } from '@renderer/lib/controls'
import { fileName } from '@renderer/lib/paths'
import { cn } from '@renderer/lib/utils'
import { type ReviewFocusSection, useReviewFocusStore } from '@renderer/stores/review-focus'
import { TestIds } from '@shared/test-ids'
import { Eraser } from 'lucide-react'
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

/**
 * The Feature tab's live companion to the Review document: the chapter under the
 * reader's eyes (published by the reading surface on scroll), the note invariants
 * of the visible file, its open-comment count, and Clear review (inline — was a
 * lone … menu item on the Feature list). Renders nothing without a review set —
 * the companion follows the document.
 */
export function ReviewGroup(): React.JSX.Element | null {
  const { reading } = useFeatureReading()
  const activeSection = useReviewFocusStore((s) => s.activeSection)
  const visiblePath = useReviewFocusStore((s) => s.visiblePath)
  const comments = useReviewComments()
  const { clear, isClearing } = useClearFeatureReview()
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)

  // Empty Review: companion matches the viewer empty state (U8), not a void.
  if (reading === null) {
    return (
      <SidebarGroup className="px-3">
        <SidebarGroupLabel className={LABEL_CLASS}>Review</SidebarGroupLabel>
        <SidebarGroupContent className="px-1">
          <div className="rounded-xl border border-dashed bg-muted/20 p-2.5 text-2xs text-muted-foreground">
            No Review published yet. Ask your agent to run the porcelain-companion skill, or copy
            the prompt from the center canvas empty state.
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  if (!reading) return null

  const section =
    typeof activeSection === 'number' && activeSection < reading.sections.length
      ? reading.sections[activeSection]
      : undefined
  const proseLine = section ? firstProseLine(section.prose) : null

  // The visible file's agent notes (a file anchored in several places carries the
  // same note — dedupe) and its open comments.
  const notes = visiblePath
    ? [
        ...new Set(
          [...reading.sections.flatMap((s) => s.files), ...reading.groups.flatMap((g) => g.files)]
            .filter((file) => file.path === visiblePath)
            .map((file) => file.note)
            .filter((note): note is string => note !== undefined && note !== ''),
        ),
      ]
    : []
  const openCommentCount = visiblePath
    ? comments.filter((c) => c.path === visiblePath && !c.resolved).length
    : 0

  const runClear = async (): Promise<void> => {
    setClearError(null)
    try {
      await clear()
      setConfirmClearOpen(false)
    } catch (e) {
      setClearError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <SidebarGroup className="px-3">
      <SidebarGroupLabel className={LABEL_CLASS}>Now reading</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-1.5 px-1">
        <div className="rounded-xl border bg-card p-2">
          <span className="block truncate text-xs font-medium">
            {chapterTitle(reading, activeSection)}
          </span>
          {proseLine && (
            <p className="mt-1 line-clamp-2 text-xs-minus text-muted-foreground">{proseLine}</p>
          )}
        </div>
        {visiblePath && (
          <div className="rounded-xl border bg-card p-2">
            <span className="block truncate font-mono text-2xs text-muted-foreground">
              {fileName(visiblePath)}
            </span>
            {notes.map((note) => (
              <p key={note} className="mt-1 break-words text-xs-minus text-muted-foreground">
                <span className="mr-1.5 text-3xs font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                  Note
                </span>
                {note}
              </p>
            ))}
            {openCommentCount > 0 && (
              <p className="mt-1 text-2xs text-muted-foreground/70">
                {openCommentCount} open comment{openCommentCount === 1 ? '' : 's'}
              </p>
            )}
          </div>
        )}
        {/* Single destructive action for the Review — inline, not buried in … */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(rowActionClass, 'h-7 w-full justify-start gap-1.5 text-destructive')}
          disabled={isClearing}
          data-testid={TestIds.featureClearReview}
          onClick={() => setConfirmClearOpen(true)}
        >
          <Eraser />
          Clear review & evidence
        </Button>
        {clearError && (
          <p className="whitespace-pre-wrap font-mono text-2xs text-destructive">{clearError}</p>
        )}
      </SidebarGroupContent>

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
    </SidebarGroup>
  )
}
