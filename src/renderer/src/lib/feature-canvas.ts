/**
 * The Feature Review canvas is three tabs — Intent → Execution → Evidence —
 * matching the human review questions. Shared by the viewer chrome and the
 * Feature sidebar so labels, subtitles, and jump targets stay one source.
 */

export type FeatureCanvasTab = 'intent' | 'execution' | 'evidence'

export interface FeatureCanvasTabMeta {
  id: FeatureCanvasTab
  /** Short tab label in the viewer + sidebar pills. */
  label: string
  /** Human question — shown as the tab subtitle so the job is obvious. */
  question: string
}

export const FEATURE_CANVAS_TABS: readonly FeatureCanvasTabMeta[] = [
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

export function isFeatureCanvasTab(value: string): value is FeatureCanvasTab {
  return value === 'intent' || value === 'execution' || value === 'evidence'
}

export function featureCanvasTabMeta(id: FeatureCanvasTab): FeatureCanvasTabMeta {
  const found = FEATURE_CANVAS_TABS.find((t) => t.id === id)
  if (!found) throw new Error(`unknown Feature canvas tab: ${id}`)
  return found
}
