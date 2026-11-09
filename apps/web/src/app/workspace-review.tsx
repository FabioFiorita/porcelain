import {
  ReviewWorkspace,
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

export function WorkspaceReview(
  props: Omit<
    ReviewWorkspaceProps,
    | 'handoff'
    | 'reviewFile'
    | 'agentNote'
    | 'changesNavigation'
    | 'firstTabCount'
  >,
) {
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
