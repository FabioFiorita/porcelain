import { CircleXIcon, HistoryIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  proofLabel,
  proofStatus,
  publishedLabel,
} from '@porcelain/client/reviews/rules';
import type {
  ReviewResponse,
  ReviewScope,
} from '@porcelain/client/reviews/rules';
import { ActiveReview } from './active-review';
import { DocumentToolbar } from './document-toolbar';
import { ProofList } from './proof-list';
import { ReviewEmpty } from './review-empty';
import { type ConnectionContext } from '@/shared/workspace/connection';

export function ProofDocument({
  scope,
  context,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
}) {
  return (
    <ActiveReview
      scope={scope}
      context={context}
      absent="Proof comes with a published review. This worktree has no review now."
    >
      {(review) => (
        <PublishedProof scope={scope} context={context} review={review} />
      )}
    </ActiveReview>
  );
}

function PublishedProof({
  scope,
  context,
  review,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  review: ReviewResponse;
}) {
  const status = proofStatus(review.proof);
  const empty =
    review.proof.checks.length === 0 && review.proof.assets.length === 0;
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Proof">
      <DocumentToolbar
        title="Proof"
        subtitle={`Published ${publishedLabel(review.publishedAt)} · checks ${proofLabel(status)} · ${review.proof.assets.length} ${review.proof.assets.length === 1 ? 'attachment' : 'attachments'}`}
      />
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="flex max-w-3xl flex-col gap-4">
          {status.failing > 0 && (
            <Alert variant="destructive">
              <CircleXIcon />
              <AlertTitle>
                {status.failing === 1
                  ? '1 check failed'
                  : `${status.failing} checks failed`}
              </AlertTitle>
              <AlertDescription>
                The agent reported this work as not passing yet.
              </AlertDescription>
            </Alert>
          )}
          {!status.current && !empty && (
            <Alert>
              <HistoryIcon />
              <AlertTitle>
                These checks ran before the latest changes
              </AlertTitle>
              <AlertDescription>
                The code changed after the agent published this proof. Ask it to
                run the checks again.
              </AlertDescription>
            </Alert>
          )}
          {empty ? (
            <ReviewEmpty
              title="No proof attached"
              description="The agent published this review without checks or attachments."
            />
          ) : (
            <ProofList
              scope={scope}
              context={context}
              proof={review.proof}
              layers={review.layers}
            />
          )}
        </div>
      </div>
    </section>
  );
}
