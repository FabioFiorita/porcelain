import { Badge } from '@renderer/components/ui/badge'
import { cn } from '@renderer/lib/utils'
import {
  type EvidenceCheck,
  type EvidenceCheckStatus,
  evidenceOverallStatus,
} from '@shared/evidence-check'
import { CircleCheck, CircleMinus, CircleX, ShieldCheck } from 'lucide-react'

export function EvidenceHeaderRow({
  title,
  checks,
}: {
  title: string
  checks: EvidenceCheck[]
}): React.JSX.Element {
  const overall = evidenceOverallStatus(checks)
  return (
    <div className="sticky left-0 flex max-w-[var(--vrows-vw)] items-center gap-2 border-t border-border px-3 pb-1 pt-3">
      <ShieldCheck className="size-3.5 shrink-0 text-info" />
      <h2 className="min-w-0 flex-1 truncate font-sans text-sm font-semibold">{title}</h2>
      {overall && (
        <Badge
          variant="outline"
          className={cn(
            'shrink-0 text-2xs',
            overall === 'pass' ? 'text-success' : 'text-destructive',
          )}
        >
          {overall === 'pass' ? 'Pass' : 'Fail'}
        </Badge>
      )}
    </div>
  )
}

const checkStatusStyle: Record<
  EvidenceCheckStatus,
  { Icon: typeof CircleCheck; className: string }
> = {
  pass: { Icon: CircleCheck, className: 'text-success' },
  fail: { Icon: CircleX, className: 'text-destructive' },
  skip: { Icon: CircleMinus, className: 'text-muted-foreground' },
}

export function EvidenceChecksRow({ checks }: { checks: EvidenceCheck[] }): React.JSX.Element {
  return (
    <ul className="sticky left-0 flex max-w-[var(--vrows-vw)] flex-col gap-1 px-3 py-1.5">
      {checks.map((check, index) => {
        const { Icon, className } = checkStatusStyle[check.status]
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: static per render, never reordered; labels are agent-authored and not deduped
          <li key={`${index}-${check.label}`} className="flex items-start gap-2">
            <Icon className={cn('mt-0.5 size-3.5 shrink-0', className)} />
            <span className="min-w-0 font-sans text-sm leading-snug">
              {check.label}
              {check.detail && (
                <span className="ml-2 text-xs text-muted-foreground">{check.detail}</span>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
