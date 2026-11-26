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

export function PullRequestReviewNotes({
  checkout,
  context,
  undecidedCallStep,
  callNeedingCommit,
  onOpenStep,
}: {
  checkout: Checkout;
  context: ConnectionContext;
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
      <PublishReviewButton
        owner={{ scope: checkout, context }}
        renderTrigger={(count, open) => (
          <DecisionNote
            action={
              <Button size="sm" variant="ghost" onClick={open}>
                Publish
              </Button>
            }
          >
            {count === 1
              ? '1 draft comment is not published yet.'
              : `${count} draft comments are not published yet.`}
          </DecisionNote>
        )}
      />
    </>
  );
}
