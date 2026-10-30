import { Button } from '@/components/ui/button';
import { CircleHelpIcon, MessageSquareIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  changeAnchor,
  type ReviewRevision,
  type SystemPart,
} from '@porcelain/client/reviews/rules';
import { InlineComposer } from './inline-composer';
import type { WalkthroughProps } from './walkthrough-props';

type QuestionProps = {
  part: SystemPart;
  revision: ReviewRevision;
  scope: WalkthroughProps['scope'];
  context: WalkthroughProps['context'];
};

function QuestionAnswer({
  part,
  revision,
  scope,
  context,
  autoFocus,
  onClose,
}: QuestionProps & { autoFocus: boolean; onClose?: () => void }) {
  return (
    <InlineComposer
      variant="answer"
      autoFocus={autoFocus}
      closable={onClose !== undefined}
      scope={scope}
      context={context}
      quote={part.problem}
      anchor={changeAnchor({
        base: revision.base,
        tip: revision.headOid,
      })}
      onClose={onClose ?? (() => {})}
    />
  );
}

export function AnswerableQuestion({
  part,
  revision,
  scope,
  context,
  action,
  decisionTitle,
}: QuestionProps & {
  action?: ReactNode;
  decisionTitle?: string | undefined;
}) {
  const [answering, setAnswering] = useState(false);
  const [answerButton, setAnswerButton] = useState<HTMLButtonElement | null>(
    null,
  );
  return (
    <div className="flex min-w-0 flex-col rounded-paper border border-brand/40 bg-brand-soft px-4 py-3.5">
      <p className="flex min-w-0 items-start gap-2 text-xs leading-4 font-medium text-brand">
        <CircleHelpIcon className="size-3.5 shrink-0" />
        <span className="min-w-0 wrap-anywhere">
          {[
            part.label,
            part.decision === undefined
              ? undefined
              : `Decision ${part.decision}`,
            decisionTitle,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </p>
      <p className="mt-2 text-reading leading-6 whitespace-pre-wrap wrap-anywhere">
        {part.problem}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {action}
        <Button
          ref={setAnswerButton}
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={answering}
          onClick={() => setAnswering(true)}
        >
          <MessageSquareIcon />
          Answer the agent
        </Button>
      </div>
      {answering && (
        <div className="mt-3 rounded-lg border bg-card p-3">
          <QuestionAnswer
            part={part}
            revision={revision}
            scope={scope}
            context={context}
            autoFocus
            onClose={() => {
              setAnswering(false);
              answerButton?.focus();
            }}
          />
        </div>
      )}
    </div>
  );
}

export function MarginQuestion({
  part,
  revision,
  scope,
  context,
}: QuestionProps) {
  return (
    <section
      aria-label={`Needs your decision: ${part.label}`}
      className="flex min-w-0 flex-col gap-2.5 rounded-paper border bg-card p-3 shadow-pop"
    >
      <p className="flex items-center gap-1.5 text-xs leading-4 font-semibold text-brand">
        <CircleHelpIcon className="size-3.5 shrink-0" />
        Needs your decision
      </p>
      <div className="min-w-0 wrap-anywhere">
        <p className="text-ui leading-4.5 font-semibold">{part.label}</p>
        <p className="mt-0.75 text-ui leading-4.75 whitespace-pre-wrap">
          {part.problem}
        </p>
      </div>
      <div className="border-t pt-2.5">
        <QuestionAnswer
          part={part}
          revision={revision}
          scope={scope}
          context={context}
          autoFocus={false}
        />
      </div>
    </section>
  );
}
