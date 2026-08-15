import { create } from 'zustand'

/** The Review's four canvases, in the order they answer their questions. */
export type ReviewCanvasTab = 'intent' | 'process' | 'execution' | 'evidence'

/**
 * A block of the Execution outline: one walkthrough section, or one "More files" group.
 * The id is derived from the reading (`section:<index>` / `group:<layer>`), never from a
 * render position, so a jump survives the next poll re-ordering nothing.
 */
export type ExecutionFocus = { blockId: string; token: number } | null

/**
 * Which Evidence pane is up, as ONE key: `checks`, `assets`, or `doc:<file>` for a document
 * from `evidence/results/`.
 *
 * It was two pieces of state — a `checks | results | assets` sub-tab plus, inside Results, a
 * separately remembered document — which is what forced a third strip of tabs onto the screen
 * whenever a pack published more than one document. Intent already models its documents and its
 * board as one flat set of panes; Evidence now says the same thing the same way, and the level
 * disappears with the state that required it.
 */
export type EvidencePane = string

type ReviewState = {
  canvasTab: ReviewCanvasTab
  /**
   * Which Intent pane is up, by pane key. `null` means "the first one" — a review that
   * publishes its second document should not steal the pane the reader chose, but a reader
   * who has chosen nothing yet gets whatever comes first.
   */
  intentPane: string | null
  /**
   * Which Evidence pane is up. `null` means "the first one that has anything" — a pack with no
   * checks should open on its documents rather than a dead pane, and the reader's own pick must
   * survive the next poll landing a new document.
   */
  evidencePane: EvidencePane | null
  /** The Execution block the outline last asked for. Consumed by the Execution canvas. */
  executionFocus: ExecutionFocus
  setCanvasTab: (tab: ReviewCanvasTab) => void
  setIntentPane: (pane: string | null) => void
  setEvidencePane: (pane: EvidencePane) => void
  /** Outline tap: show Execution and scroll it to this block. */
  focusExecutionBlock: (blockId: string) => void
  clearExecutionFocus: () => void
}

/**
 * Review view state — which canvas is up, which document inside it, and where the outline
 * last pointed.
 *
 * Shared by both form factors rather than split like Changes' selection: the Review has no
 * per-item detail route to push, so there is no navigation model to be native to. The tablet
 * reads it across three columns (outline · canvas · companion) and the phone reads the same
 * state in one, which is what keeps a jump from the outline meaning the same thing on both.
 *
 * Deliberately not persisted: the tab you were reading before a cold start belongs to a
 * review that may since have been archived, and restoring it would fire an 8 MiB intent read
 * before the environment has reconnected.
 */
export const useReviewStore = create<ReviewState>()((set) => ({
  canvasTab: 'intent',
  evidencePane: null,
  executionFocus: null,
  intentPane: null,
  clearExecutionFocus: () => {
    set({ executionFocus: null })
  },
  focusExecutionBlock: (blockId) => {
    // The token makes a repeat tap on the same block a new request: the canvas may have been
    // scrolled away since, and an unchanged value would not re-trigger the jump.
    set((state) => ({
      canvasTab: 'execution',
      executionFocus: { blockId, token: (state.executionFocus?.token ?? 0) + 1 },
    }))
  },
  setCanvasTab: (canvasTab) => {
    set({ canvasTab })
  },
  setEvidencePane: (evidencePane) => {
    set({ evidencePane })
  },
  setIntentPane: (intentPane) => {
    set({ intentPane })
  },
}))
