import {
  teachRequest,
  type ReviewLayer,
  type ReviewRevision,
} from '@porcelain/client/reviews/rules';
import { ReviewRequest } from './review-request';
import { ThreadCard } from '../../workspace/index';
import { useComments } from '../../workspace/index';
import type { WalkthroughProps } from './walkthrough-props';

export function DecisionFeedback({
  layer,
  revision,
  scope,
  context,
}: Pick<WalkthroughProps, 'scope' | 'context'> & {
  layer: ReviewLayer;
  revision: ReviewRevision;
}) {
  const { threads } = useComments(scope, context);
  const replies = (threads ?? []).filter(
    (thread) =>
      thread.anchor.kind === 'change' &&
      thread.anchor.reviewTarget?.kind === 'decision' &&
      thread.anchor.reviewTarget.id === layer.id,
  );
  return (
    <section
      aria-label="Discuss this decision"
      className="flex min-w-0 flex-col gap-2"
    >
      <ReviewRequest
        target={{ kind: 'decision', id: layer.id }}
        label="Teach me"
        body={teachRequest(layer)}
        revision={revision}
        scope={scope}
        context={context}
      />
      {replies.map((thread) => (
        <ThreadCard
          key={thread.id}
          thread={thread}
          scope={scope}
          context={context}
        />
      ))}
    </section>
  );
}
