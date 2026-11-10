import {
  ReviewWorkspace,
  ReviewBoundary,
  firstDocumentTitleOwner,
  usePublishedReview,
  publishedReviewTitle,
  type FirstDocument,
  type ReviewWorkspaceProps,
} from '@/features/workspace/index';
import {
  HandoffDocument,
  ReviewFileDocument,
  AgentNote,
  WorkspaceReviewIndex,
  useFirstTabCount,
} from '@/features/reviews/index';
import {
  WalkthroughDocument,
  WalkthroughIndex,
  WalkthroughStepDocument,
  useWalkthroughTabTitle,
  useWorktreeFirstDocument,
} from '@/features/walkthroughs/index';
import { useAtomMount } from '@effect/atom-react';

type Props = Omit<
  ReviewWorkspaceProps,
  | 'handoff'
  | 'reviewFile'
  | 'agentNote'
  | 'changesNavigation'
  | 'firstTabCount'
  | 'stepDocument'
  | 'firstDocument'
>;

export function WorkspaceReview(props: Props) {
  return (
    <ReviewBoundary
      connection={props.context.connection}
      scope={{ projectId: props.projectId, worktreeId: props.worktree.id }}
    >
      <WorkspaceReviewContent {...props} />
    </ReviewBoundary>
  );
}

function WorkspaceReviewContent(props: Props) {
  const scope = { projectId: props.projectId, worktreeId: props.worktree.id };
  const { review } = usePublishedReview(scope, props.context);
  const worktreeFirstDocument = useWorktreeFirstDocument(
    scope,
    props.context,
    props.search.base,
  );
  const showsWalkthrough = worktreeFirstDocument.name === 'walkthrough';
  const reviewTitle = showsWalkthrough
    ? ('Walkthrough' as const)
    : publishedReviewTitle(
        worktreeFirstDocument.name === 'review' ? review : undefined,
      );
  const firstTabCount = useFirstTabCount({
    scope,
    context: props.context,
    review: showsWalkthrough ? undefined : (review ?? undefined),
    reviewTitle,
  });
  const walkthroughTitle = useWalkthroughTabTitle(scope, props.context);
  useAtomMount(
    firstDocumentTitleOwner({
      worktreeId: props.worktree.id,
      title: showsWalkthrough ? walkthroughTitle : undefined,
    }),
  );
  const firstDocument: FirstDocument = {
    title: reviewTitle,
    pending: worktreeFirstDocument.pending,
    guided: worktreeFirstDocument.guided,
  };
  return (
    <ReviewWorkspace
      {...props}
      handoff={showsWalkthrough ? WalkthroughDocument : HandoffDocument}
      reviewFile={ReviewFileDocument}
      agentNote={AgentNote}
      changesNavigation={
        worktreeFirstDocument.guided ? WalkthroughIndex : WorkspaceReviewIndex
      }
      firstTabCount={firstTabCount}
      stepDocument={WalkthroughStepDocument}
      firstDocument={firstDocument}
    />
  );
}
