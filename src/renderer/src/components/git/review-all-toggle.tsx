import { Button } from '@renderer/components/ui/button'
import { useSetReviewed } from '@renderer/hooks/use-reviewed'
import { ListChecks, ListX } from 'lucide-react'

/**
 * Header toggle that marks every changed file reviewed in one write, or clears them all
 * when the set is already fully reviewed. The bulk companion to the per-row "Mark reviewed"
 * context item — one click to check off (or reset) the whole change set.
 */
export function ReviewAllToggle({
  paths,
  allReviewed,
}: {
  paths: string[]
  allReviewed: boolean
}): React.JSX.Element {
  const setReviewed = useSetReviewed()
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="shrink-0"
      aria-label={allReviewed ? 'Unmark all reviewed' : 'Mark all reviewed'}
      onClick={() => setReviewed(allReviewed ? [] : paths)}
    >
      {allReviewed ? <ListX /> : <ListChecks />}
    </Button>
  )
}
