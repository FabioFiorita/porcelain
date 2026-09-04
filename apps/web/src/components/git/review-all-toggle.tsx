import { Button } from '@renderer/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useSetReviewed } from '@renderer/features/git'
import { ListChecks, ListX } from 'lucide-react'
import type { ReviewedScope } from '@porcelain/contracts/review'

/**
 * Header toggle that marks every changed file reviewed in one write, or clears them all
 * when the set is already fully reviewed. The bulk companion to the per-row "Mark reviewed"
 * context item — one click to check off (or reset) the whole change set.
 */
export function ReviewAllToggle({
  paths,
  allReviewed,
  scope,
}: {
  paths: string[]
  allReviewed: boolean
  scope: ReviewedScope
}): React.JSX.Element {
  const setReviewed = useSetReviewed(scope)
  const label = allReviewed ? 'Unmark all reviewed' : 'Mark all reviewed'
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            className="shrink-0"
            aria-label={label}
            onClick={() => setReviewed(paths, !allReviewed)}
          >
            {allReviewed ? <ListX className="size-3" /> : <ListChecks className="size-3" />}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
