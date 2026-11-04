import {
  optionRequest,
  type SystemPart,
  type ReviewRevision,
} from '@porcelain/client/reviews/rules';
import { ReviewRequest } from './review-request';
import { ProofMedia } from './proof-list';
import { ThreadCard } from './thread-card';
import { useComments } from '../queries/comments';
import type { WalkthroughProps } from './walkthrough-props';

export function QuestionOptions({
  part,
  revision,
  scope,
  context,
}: Pick<WalkthroughProps, 'scope' | 'context'> & {
  part: SystemPart;
  revision: ReviewRevision;
}) {
  const { threads } = useComments(scope, context);
  const assets = revision.content.proof.assets;
  const replies = (threads ?? []).filter(
    (thread) =>
      thread.anchor.kind === 'change' &&
      thread.anchor.reviewTarget?.kind === 'question' &&
      thread.anchor.reviewTarget.id === part.id,
  );
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {part.options?.map((option) => (
        <div key={option.id} className="min-w-0 rounded-md border bg-card p-2">
          <p className="text-sm font-medium wrap-anywhere">{option.label}</p>
          <p className="text-xs text-muted-foreground wrap-anywhere">
            {option.consequence}
          </p>
          {assets
            .filter(
              (asset) => asset.optionId === option.id && asset.kind !== 'link',
            )
            .map((asset) => (
              <ProofMedia
                key={asset.id}
                scope={scope}
                context={context}
                id={asset.id}
                title={asset.title}
                video={asset.kind === 'video'}
              />
            ))}
          <ReviewRequest
            key={option.id}
            target={{ kind: 'question', id: part.id }}
            label={`Choose ${option.label}`}
            body={optionRequest(part, option)}
            revision={revision}
            scope={scope}
            context={context}
          />
        </div>
      ))}
      {replies.map((thread) => (
        <ThreadCard
          key={thread.id}
          thread={thread}
          scope={scope}
          context={context}
        />
      ))}
    </div>
  );
}
