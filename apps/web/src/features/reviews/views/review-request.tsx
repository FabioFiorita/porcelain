import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  changeAnchor,
  reviewErrorMessage,
} from '@porcelain/client/reviews/rules';
import { type ReviewRevision } from '@porcelain/client/reviews/rules';
import { useAtom } from '@effect/atom-react';
import { reviewCommands } from '@porcelain/client/reviews';
import { commentWriteBinding } from '@porcelain/client/workspace';
import type { WalkthroughProps } from './walkthrough-props';

export function ReviewRequest({
  label,
  body,
  revision,
  context,
  target,
}: Pick<WalkthroughProps, 'scope' | 'context'> & {
  target?: { kind: 'decision' | 'question'; id: string };
  label: string;
  body: string;
  revision: ReviewRevision;
}) {
  const mutation = commentWriteBinding(
    useAtom(
      reviewCommands({
        reviewId: revision.reviewId,
        connection: context.connection,
      }).requestFeedback,
      { mode: 'promiseExit' },
    ),
  );
  const [intent, setIntent] = useState<{
    body: string;
    anchor: ReturnType<typeof changeAnchor>;
    threadId: string;
    messageId: string;
    reviewRevision: number;
  }>();
  const [status, setStatus] = useState<string>();
  const sent = status !== undefined;
  let buttonLabel = sent ? `${label} · posted` : label;
  if (mutation.result.waiting) buttonLabel = 'Posting…';
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <Button
        variant="ghost"
        size="xs"
        disabled={mutation.result.waiting || sent}
        onClick={() => {
          const next = intent ?? {
            body,
            anchor: {
              ...changeAnchor({ base: revision.base, tip: revision.headOid }),
              ...(target === undefined ? {} : { reviewTarget: target }),
            },
            threadId: crypto.randomUUID(),
            messageId: crypto.randomUUID(),
            reviewRevision: revision.revision,
          };
          setIntent(next);
          mutation.send(next, (answer) => setStatus(answer.delivery));
        }}
      >
        {buttonLabel}
      </Button>
      {sent && (
        <p role="status" className="text-xs text-muted-foreground">
          {status}
        </p>
      )}
      {AsyncResult.isFailure(mutation.result) && (
        <p role="alert" className="text-xs text-destructive">
          {reviewErrorMessage(Cause.squash(mutation.result.cause))}
        </p>
      )}
    </div>
  );
}
