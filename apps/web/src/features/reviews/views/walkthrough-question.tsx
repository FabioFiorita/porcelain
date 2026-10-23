import { CircleHelpIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type {
  ReviewRevision,
  SystemPart,
} from '@porcelain/client/reviews/rules';
import { cn } from '@/shared/lib/utils';
import { InlineComposer } from './inline-composer';
import type { WalkthroughProps } from './walkthrough-props';

export function DecisionQuestion({
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
        'flex min-w-0 flex-col gap-3 rounded-xl border border-graph-1/40 bg-graph-1/5 p-4',
        compact && 'gap-2 p-3',
      )}
    >
      <div className="flex items-start gap-3">
        <CircleHelpIcon className="mt-0.5 size-4 shrink-0 text-graph-1" />
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
      {action && <div className="self-start">{action}</div>}
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
    <DecisionQuestion part={part} action={action} compact={compact}>
      <Button
        ref={setAnswerButton}
        size="sm"
        variant="ghost"
        className="self-start"
        aria-expanded={answering}
        onClick={() => setAnswering(true)}
      >
        Answer this question
      </Button>
      {answering && (
        <InlineComposer
          scope={scope}
          context={context}
          quote={part.problem}
          anchor={{
            kind: 'change',
            revision: revision.headOid,
            comparison: { kind: 'branch', base: revision.base },
          }}
          onClose={() => {
            setAnswering(false);
            answerButton?.focus();
          }}
        />
      )}
    </DecisionQuestion>
  );
}
