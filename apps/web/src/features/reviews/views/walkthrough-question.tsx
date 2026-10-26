import { CircleHelpIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  changeAnchor,
  type ReviewRevision,
  type SystemPart,
} from '@porcelain/client/reviews/rules';
import { cn } from '@/shared/lib/utils';
import { InlineComposer } from './inline-composer';
import type { WalkthroughProps } from './walkthrough-props';

function DecisionQuestion({
  part,
  action,
  children,
  compact = false,
}: {
  part: SystemPart;
  action?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-xl border border-brand/40 bg-brand-soft px-4 py-3',
        compact && 'p-3',
      )}
    >
      <div className="flex items-start gap-3">
        <CircleHelpIcon className="mt-0.5 size-4 shrink-0 text-brand" />
        <div className="min-w-0 flex-1 wrap-anywhere">
          <p className={cn('text-sm font-medium', compact && 'text-xs')}>
            Needs your decision · {part.label}
          </p>
          <p
            className={cn(
              'text-sm whitespace-pre-wrap wrap-anywhere',
              compact && 'text-xs',
            )}
          >
            {part.problem}
          </p>
        </div>
      </div>
      {action && (
        <div className="flex flex-wrap items-center gap-2 self-start">
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function AnswerableQuestion({
  part,
  revision,
  scope,
  context,
  action,
  compact = false,
}: {
  part: SystemPart;
  revision: ReviewRevision;
  scope: WalkthroughProps['scope'];
  context: WalkthroughProps['context'];
  action?: ReactNode;
  compact?: boolean;
}) {
  const [answering, setAnswering] = useState(false);
  const [answerButton, setAnswerButton] = useState<HTMLButtonElement | null>(
    null,
  );
  return (
    <DecisionQuestion
      part={part}
      compact={compact}
      action={
        <>
          {action}
          <Button
            ref={setAnswerButton}
            size={compact ? 'sm' : 'xs'}
            variant="ghost"
            aria-expanded={answering}
            onClick={() => setAnswering(true)}
          >
            Answer this question
          </Button>
        </>
      }
    >
      {answering && (
        <InlineComposer
          scope={scope}
          context={context}
          quote={part.problem}
          anchor={changeAnchor({
            base: revision.base,
            tip: revision.headOid,
          })}
          onClose={() => {
            setAnswering(false);
            answerButton?.focus();
          }}
        />
      )}
    </DecisionQuestion>
  );
}
