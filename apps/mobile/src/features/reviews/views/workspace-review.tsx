import type { ReactNode } from 'react';
import { AsyncResult } from 'effect/reactivity';
import type { Workspace, OpenedReview } from '../../projects/index';
import { useWorkspaceReview, ReviewReadState } from '../../workspace/index';
import { LinkedReviewPane } from './linked-review-screen';
import { PublishedWalkthrough } from './published-walkthrough';
import { PublishedOverview, PublishedOverviewBar } from './published-review';

export function CurrentWorkspaceReview({
  workspace,
  review,
  children,
}: {
  workspace: Workspace;
  review: OpenedReview;
  children: ReactNode;
}) {
  const publication = useWorkspaceReview(workspace);
  if (
    !AsyncResult.isSuccess(publication.published) ||
    publication.published.waiting
  )
    return (
      <ReviewReadState
        result={publication.published}
        refresh={publication.refreshPublished}
      />
    );
  return workspace.connection.environmentId === review.environmentId &&
    publication.published.value?.reviewId === review.reviewId ? (
    children
  ) : (
    <LinkedReviewPane review={review} />
  );
}
export function WorkspacePublishedOverview({
  workspace,
  bar = false,
}: {
  workspace: Workspace;
  bar?: boolean;
}) {
  return bar ? (
    <PublishedWalkthrough workspace={workspace} states="hidden">
      {(walkthrough) => <PublishedOverviewBar walkthrough={walkthrough} />}
    </PublishedWalkthrough>
  ) : (
    <PublishedWalkthrough workspace={workspace}>
      {(walkthrough) => <PublishedOverview walkthrough={walkthrough} />}
    </PublishedWalkthrough>
  );
}
