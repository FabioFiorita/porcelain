import { useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { readWalkthroughConversations } from '@porcelain/client/walkthroughs';
import {
  undecidedCallStep,
  type WalkthroughContent,
} from '@porcelain/client/walkthroughs/rules';
import {
  PublishReviewButton,
  useUnpublishedCount,
} from '@/features/comments/index';
import { Button } from '@/components/ui/button';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { DecisionNote } from './pull-request-decision';

type Checkout = { projectId: string; worktreeId: string };

function UndecidedCall({
  checkout,
  context,
  runId,
  content,
  onOpenStep,
}: {
  checkout: Checkout;
  context: ConnectionContext;
  runId: string;
  content: WalkthroughContent;
  onOpenStep: ((step: number) => void) | undefined;
}) {
  const result = useAtomValue(
    readWalkthroughConversations({
      connection: context.connection,
      runId,
      scope: checkout,
    }),
  );
  const view = Option.getOrUndefined(AsyncResult.value(result));
  const step = undecidedCallStep(content, view?.decisions, false);
  if (typeof step !== 'number') return null;
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

function Unpublished({
  checkout,
  context,
}: {
  checkout: Checkout;
  context: ConnectionContext;
}) {
  const owner = { scope: checkout, context };
  const count = useUnpublishedCount(owner);
  if (count === 0) return null;
  return (
    <DecisionNote
      action={
        <PublishReviewButton owner={owner} variant="ghost" label="Publish" />
      }
    >
      {count === 1
        ? '1 review comment is not published yet.'
        : `${count} review comments are not published yet.`}
    </DecisionNote>
  );
}

export function PullRequestReviewNotes({
  checkout,
  context,
  walkthrough,
  onOpenStep,
}: {
  checkout: Checkout;
  context: ConnectionContext;
  walkthrough: { runId: string; content: WalkthroughContent } | undefined;
  onOpenStep: ((step: number) => void) | undefined;
}) {
  return (
    <>
      {walkthrough && (
        <UndecidedCall
          checkout={checkout}
          context={context}
          runId={walkthrough.runId}
          content={walkthrough.content}
          onOpenStep={onOpenStep}
        />
      )}
      <Unpublished checkout={checkout} context={context} />
    </>
  );
}
