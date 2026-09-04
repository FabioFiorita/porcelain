import type { ReviewReadinessInput, ReviewReadinessOutput } from '@porcelain/contracts/review'
import { Badge } from '@renderer/components/ui/badge'
import { useReviewReadiness } from '@renderer/features/review'
import { cn } from '@renderer/lib/utils'
import { AlertTriangle, CircleDashed, ShieldCheck } from 'lucide-react'

export function reviewReadinessLabel(readiness: ReviewReadinessOutput): string {
  if (readiness.freshness === 'unavailable') return 'Review unavailable'
  if (readiness.freshness === 'absent') return 'Review missing'
  if (readiness.freshness === 'stale') return 'Review stale'
  if (readiness.evidence.failed > 0) return 'Review has failed checks'
  if (readiness.coverage.missingCount > 0) return 'Review incomplete'
  if (readiness.evidence.passed === 0) return 'Review needs evidence'
  return 'Review ready'
}

/** Compact, independently-derived Review state. Changes remains authoritative for the diff. */
export function ReviewReadiness({
  scope,
  className,
}: {
  scope: ReviewReadinessInput['scope']
  className?: string
}): React.JSX.Element {
  const { readiness, error } = useReviewReadiness(scope)
  if (error !== null) {
    return (
      <Badge variant="outline" className={cn('gap-1 text-destructive', className)}>
        <AlertTriangle className="size-3" /> Review status failed
      </Badge>
    )
  }
  if (readiness === undefined) {
    return (
      <Badge variant="outline" className={cn('gap-1 text-muted-foreground', className)}>
        <CircleDashed className="size-3" /> Checking review…
      </Badge>
    )
  }
  const ready = reviewReadinessLabel(readiness) === 'Review ready'
  const details =
    readiness.freshness === 'current'
      ? `${readiness.coverage.orderedFileCount}/${readiness.coverage.changedFileCount} files ordered · ${readiness.evidence.passed}/${readiness.evidence.checks} checks passed`
      : readiness.freshness === 'stale'
        ? 'The selected diff changed after this Review was written.'
        : readiness.freshness === 'unavailable'
          ? 'A Review exists, but Porcelain cannot read it.'
          : 'No Review Canvas is attached to this scope.'
  const Icon = ready ? ShieldCheck : AlertTriangle
  return (
    <Badge
      variant="outline"
      className={cn('gap-1', ready ? 'text-success' : 'text-muted-foreground', className)}
      title={details}
    >
      <Icon className="size-3" /> {reviewReadinessLabel(readiness)}
    </Badge>
  )
}
