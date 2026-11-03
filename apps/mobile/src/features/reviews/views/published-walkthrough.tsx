import type { ReactNode } from 'react';
import { AsyncResult } from 'effect/reactivity';
import {
  walkthroughStops,
  type ReviewResponse,
  type ReviewRevision,
  type WalkthroughStop,
} from '@porcelain/client/reviews/rules';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import type { Workspace } from '../../projects';
import { useWorkspaceReview } from '../queries/linked-review';
import { useReviewSnapshot } from '../queries/review';
import { useWalkthroughProgress } from '../queries/walkthrough';
import { ReviewReadState } from './read-state';

export type PublishedWalkthroughState = {
  workspace: Workspace;
  review: ReviewResponse;
  revision: ReviewRevision;
  stops: readonly WalkthroughStop[];
  progress: ReturnType<typeof useWalkthroughProgress>;
  changedPaths: readonly string[];
  unavailable: boolean;
  refresh: () => void;
};

export function PublishedWalkthrough({
  workspace,
  states = 'shown',
  children,
}: {
  workspace: Workspace;
  states?: 'shown' | 'hidden';
  children: (walkthrough: PublishedWalkthroughState) => ReactNode;
}) {
  const result = useWorkspaceReview(workspace);
  const ready =
    AsyncResult.isSuccess(result.published) &&
    Boolean(result.published.value?.reviewId) &&
    AsyncResult.isSuccess(result.revision) &&
    Boolean(result.revision.value.revision);
  if (states === 'hidden' && !ready) return null;
  if (!AsyncResult.isSuccess(result.published))
    return (
      <ReviewReadState
        result={result.published}
        refresh={result.refreshPublished}
      />
    );
  const review = result.published.value;
  if (!review)
    return (
      <Empty
        title="No agent review"
        description="The agent has not published a review of this worktree. Its changed files are listed below."
      />
    );
  if (!review.reviewId)
    return (
      <ErrorState message="This publication has no saved revision. Ask the agent to publish it again." />
    );
  if (!AsyncResult.isSuccess(result.revision))
    return (
      <ReviewReadState
        result={result.revision}
        refresh={result.refreshRevision}
      />
    );
  if (!result.revision.value.revision)
    return (
      <ErrorState
        message="This review revision could not be found."
        retry={{ label: 'Read again', onPress: result.refreshRevision }}
      />
    );
  return (
    <WalkthroughContent
      key={`${workspace.key}:${review.publishedAt}:${review.revision}`}
      workspace={workspace}
      review={review}
      revision={result.revision.value.revision}
      settled={result.settled}
      specsApart={result.specsApart}
      refresh={result.refreshPublished}
    >
      {children}
    </WalkthroughContent>
  );
}

function WalkthroughContent({
  workspace,
  review,
  revision,
  settled,
  specsApart,
  refresh,
  children,
}: {
  workspace: Workspace;
  review: ReviewResponse;
  revision: ReviewRevision;
  settled: boolean;
  specsApart: boolean;
  refresh: () => void;
  children: (walkthrough: PublishedWalkthroughState) => ReactNode;
}) {
  const progress = useWalkthroughProgress(workspace, revision, settled);
  const snapshot = useReviewSnapshot(workspace, { kind: 'worktree' });
  const changedPaths =
    AsyncResult.isSuccess(snapshot.result) &&
    !snapshot.result.waiting &&
    snapshot.result.value.kind === 'worktree'
      ? snapshot.result.value.answer.changes.map((file) => file.path)
      : [];
  return children({
    workspace,
    review,
    revision,
    stops: walkthroughStops(
      review,
      revision.files.map((file) => file.path),
      { specsApart },
    ),
    progress,
    changedPaths,
    unavailable: review.diagnostics === 'unavailable',
    refresh,
  });
}
