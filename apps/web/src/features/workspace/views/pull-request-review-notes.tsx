import type { PullRequestMergeReview } from '@porcelain/client/projects/rules';
import { PublishReviewButton } from '@/features/comments/index';
import { Button } from '@/components/ui/button';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { DecisionNote } from './pull-request-decision';

type Checkout = { projectId: string; worktreeId: string };

function UndecidedCall({
  step,
  onOpenStep,
}: {
  step: number;
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
      Your call in step {step} is not decided yet.
    </DecisionNote>
  );
}

export function PullRequestReviewNotes({
  checkout,
  context,
  undecidedCallStep,
  onOpenStep,
}: {
  checkout: Checkout;
  context: ConnectionContext;
  undecidedCallStep: PullRequestMergeReview['undecidedCallStep'];
  onOpenStep: ((step: number) => void) | undefined;
}) {
  return (
    <>
      {typeof undecidedCallStep === 'number' && (
        <UndecidedCall step={undecidedCallStep} onOpenStep={onOpenStep} />
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
              ? '1 review comment is not published yet.'
              : `${count} review comments are not published yet.`}
          </DecisionNote>
        )}
      />
    </>
  );
}
