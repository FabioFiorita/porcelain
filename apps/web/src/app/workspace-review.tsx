import {
  ReviewWorkspace,
  ReviewBoundary,
  usePublishedReview,
  publishedReviewTitle,
  type ReviewWorkspaceProps,
} from '@/features/workspace/index';
import {
  HandoffDocument,
  ReviewFileDocument,
  AgentNote,
  WorkspaceReviewIndex,
  useFirstTabCount,
} from '@/features/reviews/index';

type Props = Omit<
  ReviewWorkspaceProps,
  'handoff' | 'reviewFile' | 'agentNote' | 'changesNavigation' | 'firstTabCount'
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
  const firstTabCount = useFirstTabCount({
    scope,
    context: props.context,
    review: review ?? undefined,
    reviewTitle: publishedReviewTitle(review),
  });
  return (
    <ReviewWorkspace
      {...props}
      handoff={HandoffDocument}
      reviewFile={ReviewFileDocument}
      agentNote={AgentNote}
      changesNavigation={WorkspaceReviewIndex}
      firstTabCount={firstTabCount}
    />
  );
}
