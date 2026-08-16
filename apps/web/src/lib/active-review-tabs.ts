/**
 * The Review is a four-tab canvas — Intent → Process → Execution → Evidence — matching the
 * human review questions. Shared by the Canvas viewer chrome so labels, subtitles,
 * and jump targets stay one source.
 */

export type ActiveReviewTab = 'intent' | 'process' | 'execution' | 'evidence'

export interface ActiveReviewTabMeta {
  id: ActiveReviewTab
  /** Short tab label in the Canvas viewer. */
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
    id: 'process',
    label: 'Process',
    question: 'How does this work, and what should I follow?',
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
  return value === 'intent' || value === 'process' || value === 'execution' || value === 'evidence'
}
