/**
 * The Review is a three-tab canvas — Intent → Execution → Evidence — matching the
 * human review questions. Shared by the viewer chrome and the Review sidebar so
 * labels, subtitles, and jump targets stay one source.
 */

export type ActiveReviewTab = 'intent' | 'execution' | 'evidence'

export interface ActiveReviewTabMeta {
  id: ActiveReviewTab
  /** Short tab label in the viewer + sidebar pills. */
  label: string
  /** Human question — shown as the tab subtitle so the job is obvious. */
  question: string
}

export const ACTIVE_REVIEW_TABS: readonly ActiveReviewTabMeta[] = [
  {
    id: 'intent',
    label: 'Intent',
    question: 'What is this, and what’s the idea?',
  },
  {
    id: 'execution',
    label: 'Execution',
    question: 'What did the agent touch, and is the code right?',
  },
  {
    id: 'evidence',
    label: 'Evidence',
    question: 'Did it actually work?',
  },
] as const

export function isActiveReviewTab(value: string): value is ActiveReviewTab {
  return value === 'intent' || value === 'execution' || value === 'evidence'
}
