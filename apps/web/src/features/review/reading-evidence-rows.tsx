import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { cn } from '@renderer/lib/utils'
import { runUserAction } from '@shared/background'
import {
  type EvidenceCheck,
  type EvidenceCheckStatus,
  evidenceOverallStatus,
} from '@shared/evidence-check'
import { TestIds } from '@shared/test-ids'
import { CircleCheck, CircleMinus, CircleX, Eraser, ShieldCheck } from 'lucide-react'
import { useClearEvidence } from './review-mutations'

export function EvidenceHeaderRow({
  title,
  checks,
}: {
  title: string
  checks: EvidenceCheck[]
}): React.JSX.Element {
  const { clear, isClearing } = useClearEvidence()
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
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              className="shrink-0 text-muted-foreground"
              onClick={() => {
                runUserAction(clear, (error) => {
                  console.error('Clear evidence failed', error)
                })
              }}
              disabled={isClearing}
              aria-label="Clear evidence"
              data-testid={TestIds.evidenceClear}
            >
              <Eraser />
            </Button>
          }
        />
        <TooltipContent>Clear evidence</TooltipContent>
      </Tooltip>
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
