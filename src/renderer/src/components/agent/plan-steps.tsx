import { cn } from '@renderer/lib/utils'
import type { TimelineItem } from '@shared/agent-protocol'
import { Check } from 'lucide-react'

export type PlanStep = Extract<TimelineItem, { kind: 'plan' }>['steps'][number]

/**
 * The shared plan step rows — a status glyph (done: muted check, active: filled dot with
 * the row slightly lit, pending: hollow dot) beside each step. Rendered by both the
 * timeline's plan card (agent-view) and the Quick Access Plan group; deliberately quiet.
 */
export function PlanSteps({ steps }: { steps: PlanStep[] }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      {steps.map((step) => (
        <div
          key={step.text}
          className={cn(
            'flex items-start gap-2 text-xs',
            step.status === 'active' ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          <span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center">
            {step.status === 'done' ? (
              <Check className="size-3.5 text-muted-foreground" />
            ) : step.status === 'active' ? (
              <span className="size-2 rounded-full bg-foreground/80" />
            ) : (
              <span className="size-2 rounded-full border border-muted-foreground/50" />
            )}
          </span>
          <span
            className={cn(
              'min-w-0 flex-1',
              step.status === 'done' && 'line-through decoration-muted-foreground/40',
            )}
          >
            {step.text}
          </span>
        </div>
      ))}
    </div>
  )
}
