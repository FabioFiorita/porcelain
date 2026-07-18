import type { FeatureReading } from '@backend/feature-view'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from '@renderer/components/ui/sidebar'
import { useReviewComments } from '@renderer/hooks/use-comments'
import { useFeatureReading } from '@renderer/hooks/use-feature-reading'
import { fileName } from '@renderer/lib/paths'
import { type ReviewFocusSection, useReviewFocusStore } from '@renderer/stores/review-focus'

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
  if (active === 'evidence') return reading.evidence?.title ?? 'Loop evidence'
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
 * of the visible file, and its open-comment count. Renders nothing without a
 * review set — the companion follows the document.
 */
export function ReviewGroup(): React.JSX.Element | null {
  const { reading } = useFeatureReading()
  const activeSection = useReviewFocusStore((s) => s.activeSection)
  const visiblePath = useReviewFocusStore((s) => s.visiblePath)
  const comments = useReviewComments()

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
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
