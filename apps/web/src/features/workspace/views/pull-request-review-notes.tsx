import { MessageSquareIcon } from 'lucide-react';
import type { PullRequestMergeReview } from '@porcelain/client/projects/rules';
import { PublishReviewButton } from '@/features/comments/index';
import { Button } from '@/components/ui/button';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { DecisionNote } from './pull-request-decision';

type Checkout = { projectId: string; worktreeId: string };

function CallNote({
  step,
  state,
  onOpenStep,
}: {
  step: number;
  state: string;
  onOpenStep: ((step: number) => void) | undefined;
}) {
  return (
    <DecisionNote
      action={
        onOpenStep && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => onOpenStep(step)}
          >
            Open step {step}
          </Button>
        )
      }
    >
      Your call in Walkthrough step {step} {state}. Merge waits for it.
    </DecisionNote>
  );
}

export function PullRequestCallNotes({
  undecidedCallStep,
  callNeedingCommit,
  onOpenStep,
}: {
  undecidedCallStep: PullRequestMergeReview['undecidedCallStep'];
  callNeedingCommit: number | undefined;
  onOpenStep: ((step: number) => void) | undefined;
}) {
  return (
    <>
      {typeof undecidedCallStep === 'number' && (
        <CallNote
          step={undecidedCallStep}
          state="is not decided yet"
          onOpenStep={onOpenStep}
        />
      )}
      {callNeedingCommit !== undefined && (
        <CallNote
          step={callNeedingCommit}
          state="needs a new commit"
          onOpenStep={onOpenStep}
        />
      )}
    </>
  );
}

export function PullRequestDraftNote({
  checkout,
  context,
}: {
  checkout: Checkout;
  context: ConnectionContext;
}) {
  return (
    <PublishReviewButton
      owner={{ scope: checkout, context }}
      renderTrigger={(count, open) => (
        <p className="flex min-h-7 min-w-0 items-center gap-2 text-ui leading-4.5 text-muted-foreground">
          <MessageSquareIcon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="min-w-0 py-1 wrap-anywhere">
            {count === 1
              ? '1 draft comment is not published yet.'
              : `${count} draft comments are not published yet.`}
          </span>
          <Button size="sm" variant="ghost" className="shrink-0" onClick={open}>
            Publish review
          </Button>
        </p>
      )}
    />
  );
}
