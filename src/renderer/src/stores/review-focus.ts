import { create } from 'zustand'

/**
 * Where the Review document is, and where to send it next. One concern: the review
 * surface publishes the topmost visible chapter + file on scroll, the outline
 * (Feature list) and Quick Access subscribe, and either side can request a jump
 * that the surface consumes by scrolling itself.
 */

/**
 * The active chapter of the Review document: a section index (where
 * `sections.length` is the synthetic "More files" chapter), `'evidence'` for the
 * loop-evidence chapter, or `null` above the first section header.
 */
export type ReviewFocusSection = number | 'evidence' | null

export type ReviewJumpTarget =
  | { kind: 'top' }
  | { kind: 'section'; index: number }
  | { kind: 'evidence' }

interface ReviewFocusState {
  /** Topmost visible chapter, published by the review surface on scroll. */
  activeSection: ReviewFocusSection
  /** Repo-relative path of the topmost visible file block (null between files). */
  visiblePath: string | null
  /** Pending jump request; the nonce re-fires a jump to the already-active target. */
  jump: { target: ReviewJumpTarget; nonce: number } | null
  setVisible: (activeSection: ReviewFocusSection, visiblePath: string | null) => void
  requestJump: (target: ReviewJumpTarget) => void
  clearJump: () => void
}

export const useReviewFocusStore = create<ReviewFocusState>((set) => ({
  activeSection: null,
  visiblePath: null,
  jump: null,
  // Returning the state object unchanged skips the notify — the scroll handler
  // calls this per top-row change, and subscribers must not re-render otherwise.
  setVisible: (activeSection, visiblePath) =>
    set((s) =>
      s.activeSection === activeSection && s.visiblePath === visiblePath
        ? s
        : { activeSection, visiblePath },
    ),
  requestJump: (target) => set((s) => ({ jump: { target, nonce: (s.jump?.nonce ?? 0) + 1 } })),
  clearJump: () => set({ jump: null }),
}))

/** The shape of the Review document the J/K navigation walks (derived from the reading). */
export interface ReviewDocShape {
  sectionCount: number
  /** Unanchored files exist — the synthetic "More files" chapter renders. */
  hasMoreFiles: boolean
  hasEvidence: boolean
}

/**
 * The ordered J/K stops of a Review document: each section, then "More files"
 * (only when sections exist — a section-less document is one flat group list with
 * no headers to stop at), then the evidence chapter.
 */
export function jumpTargets(doc: ReviewDocShape): ReviewJumpTarget[] {
  const targets: ReviewJumpTarget[] = []
  for (let i = 0; i < doc.sectionCount; i++) targets.push({ kind: 'section', index: i })
  if (doc.hasMoreFiles && doc.sectionCount > 0) {
    targets.push({ kind: 'section', index: doc.sectionCount })
  }
  if (doc.hasEvidence) targets.push({ kind: 'evidence' })
  return targets
}

function positionOf(targets: readonly ReviewJumpTarget[], active: ReviewFocusSection): number {
  if (active === null) return -1
  return targets.findIndex((t) =>
    active === 'evidence' ? t.kind === 'evidence' : t.kind === 'section' && t.index === active,
  )
}

/**
 * The next (J, `direction` 1) or previous (K, −1) stop from the active chapter.
 * Before the first section, J goes to the first stop; K from the first stop (or
 * from nowhere in particular) returns to the top; J past the last stop stays put
 * (returns null).
 */
export function nextTarget(
  targets: readonly ReviewJumpTarget[],
  active: ReviewFocusSection,
  direction: 1 | -1,
): ReviewJumpTarget | null {
  if (targets.length === 0) return null
  const pos = positionOf(targets, active)
  if (direction === 1) {
    const next = targets[pos + 1]
    return next ?? null
  }
  if (pos <= 0) return active === null ? null : { kind: 'top' }
  return targets[pos - 1] ?? null
}
