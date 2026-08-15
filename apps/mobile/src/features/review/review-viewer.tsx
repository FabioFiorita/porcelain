import { ReviewCanvas } from './review-canvas'

/**
 * The tablet's viewer column: the Review canvas, on whichever of its four tabs the outline
 * or the tab strip last chose.
 *
 * Tablet-only. This column is always on screen beside the outline, so it has no back
 * affordance and no tab-bar inset to clear; the phone renders the same canvas inside its own
 * tab body, which passes both.
 */
export function ReviewViewer({ active }: { active: boolean }): React.JSX.Element {
  return <ReviewCanvas active={active} />
}
