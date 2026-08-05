import type { FeatureReading, FileSource, ReadingFile } from '@/lib/daemon/procedures/review'

/**
 * Lifecycle of the one active Review story for a repo — ported from the web client's
 * `lib/review-lifecycle.ts` and deliberately kept identical.
 *
 * These are the functions that decide what phase the unit is in, what the companion says
 * about it, and which prompt the human hands back to the agent. Two clients reading the same
 * `.porcelain/review.json` must agree on all three, so this file stays a port rather than a
 * mobile interpretation: pure, DOM-free, and changed only in lockstep with its twin.
 */
export type ReviewLifecyclePhase = 'empty' | 'in_progress' | 'ready_to_close'

export type ReviewLifecycleInput = {
  reading: FeatureReading | null
  /** Reviewed files / total outline files (0 when no files). */
  reviewedFraction: number
}

/** Unique files across sections + more-files groups. */
export function reviewOutlineFiles(reading: FeatureReading): ReadingFile[] {
  const seen = new Set<string>()
  const out: ReadingFile[] = []
  for (const file of [
    ...reading.sections.flatMap((s) => s.files),
    ...reading.groups.flatMap((g) => g.files),
  ]) {
    if (seen.has(file.path)) continue
    seen.add(file.path)
    out.push(file)
  }
  return out
}

export function hasIntentContent(reading: FeatureReading): boolean {
  if (reading.canvas !== undefined) return true
  if (reading.thesis !== undefined && reading.thesis.trim() !== '') return true
  return reading.sections.some((s) => s.title.trim() !== '' || s.prose.trim() !== '')
}

/** Execution is "thin" when there are no files yet (Intent-only / early session). */
export function isExecutionThin(reading: FeatureReading): boolean {
  return reviewOutlineFiles(reading).length === 0
}

/**
 * Classify the active Review for canvas / list / rail cues.
 * Ready when Evidence is published and/or ≥50% of outline files are reviewed.
 */
export function reviewLifecyclePhase(input: ReviewLifecycleInput): ReviewLifecyclePhase {
  const { reading, reviewedFraction } = input
  if (reading === null) return 'empty'
  const hasEvidence = reading.evidence !== null
  const highReviewed = reviewedFraction >= 0.5 && reviewOutlineFiles(reading).length > 0
  if (hasEvidence || highReviewed) return 'ready_to_close'
  return 'in_progress'
}

export function lifecycleBadgeLabel(phase: ReviewLifecyclePhase): string | null {
  switch (phase) {
    case 'empty':
      return null
    case 'in_progress':
      return 'In progress'
    case 'ready_to_close':
      return 'Ready to close'
  }
}

export function lifecycleDetail(reading: FeatureReading, phase: ReviewLifecyclePhase): string {
  if (phase === 'ready_to_close') {
    if (reading.evidence !== null) {
      return 'Evidence is in — mark files reviewed and ship via Changes when ready.'
    }
    return 'Enough of the outline is reviewed — ship via Changes, or Clear when the unit is done.'
  }
  // in_progress
  const thinExec = isExecutionThin(reading)
  const noEvidence = reading.evidence === null
  if (thinExec && noEvidence) {
    return 'In progress — Intent is up; Execution and Evidence are still thin.'
  }
  if (thinExec) {
    return 'In progress — Execution is still thin (no files listed yet).'
  }
  if (noEvidence) {
    return 'In progress — Evidence still thin (no HTML proof yet).'
  }
  return 'In progress — keep publishing until Execution and Evidence tell the full story.'
}

/**
 * Unique-file counts per source, for the canvas legend.
 *
 * Counted off the deduped outline for the same reason the reviewed fraction is: a file the
 * agent anchored to a section AND left in a group is one file, and counting it twice would
 * make this legend disagree with the desktop's for the same repo.
 */
export function reviewSourceCounts(reading: FeatureReading): Record<FileSource, number> {
  const counts: Record<FileSource, number> = { changed: 0, context: 0, shipped: 0 }
  for (const file of reviewOutlineFiles(reading)) counts[file.source] += 1
  return counts
}

/** The share of the outline that has been ticked off — the lifecycle's other input. */
export function reviewedFractionOf(
  reading: FeatureReading,
  reviewed: ReadonlySet<string>,
): { fraction: number; reviewedCount: number; total: number } {
  const outline = reviewOutlineFiles(reading)
  const reviewedCount = outline.filter((file) => reviewed.has(file.path)).length
  return {
    fraction: outline.length === 0 ? 0 : reviewedCount / outline.length,
    reviewedCount,
    total: outline.length,
  }
}

// --- Clipboard prompts (copyText only — never navigator.clipboard) ---

/** Empty canvas / start of a unit: Intent-first, bugs and features welcome. */
export function reviewStartPrompt(options?: { name?: string }): string {
  const name = options?.name?.trim()
  const nameHint =
    name !== undefined && name.length > 0 ? name : '<short name: bug | feature | chore>'
  return [
    'Start a Review unit in Porcelain (porcelain-companion skill).',
    'This is the START of the unit — Intent first, not a fake-complete Review.',
    '',
    '1. If a previous unit is done: porcelain review clear',
    '2. porcelain review set --name "' +
      nameHint +
      '" --thesis "<one paragraph: what this is and the key idea / bug>" \\',
    '     --sections \'[{ "title": "…", "prose": "…", "anchors": [] }]\' \\',
    "     --files '[]'",
    '   (files/sections may stay light mid-session; grow Execution as you work.)',
    '3. Do NOT claim done until Execution + Evidence are real.',
    '',
    'Works for bugs, features, chores, and investigations — not features only.',
  ].join('\n')
}

/** Mid-session: grow Execution; optional thin updates OK. */
export function reviewContinuePrompt(name: string): string {
  return [
    `Continue the Review "${name}" in Porcelain (porcelain-companion skill).`,
    'Update Intent/Execution as work progresses (Intent-first mid-session updates are fine).',
    'When validating: evidence prepare + write index.html + evidence check.',
    'Do not claim the unit is done without real Evidence of what you ran.',
  ].join('\n')
}

/** End of session: complete Execution + Evidence. */
export function reviewEndPrompt(name: string): string {
  return [
    `Close the Review unit "${name}" in Porcelain (porcelain-companion skill).`,
    'END of session path:',
    '1. porcelain review set — full Execution (files + notes + sections that match what shipped)',
    '2. Validate → evidence prepare --title "…" then Write index.html in the printed dir',
    '3. evidence check --label "…" --status pass|fail --detail "…"',
    '4. comments list / resolve as needed',
    'Human reads the story, marks reviewed, ships via Changes; then Clear (or you clear before the next unit).',
    'Never invent Evidence. Bugs and features use the same lifecycle.',
  ].join('\n')
}
