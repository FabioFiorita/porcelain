import {
  ReviewWorkspace,
  ReviewIndex,
  ReviewBoundary,
  firstDocumentTitleOwner,
  type FirstDocument,
  type ReviewWorkspaceProps,
} from '@/features/workspace/index';
import {
  ReviewDocument,
  WalkthroughIndex,
  WalkthroughCodeDocument,
  useWalkthroughTabTitle,
  useWorktreeFirstDocument,
} from '@/features/walkthroughs/index';
import { useAtomMount } from '@effect/atom-react';

type Props = Omit<
  ReviewWorkspaceProps,
  'review' | 'changesNavigation' | 'walkthroughCode' | 'firstDocument'
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
  const worktreeFirstDocument = useWorktreeFirstDocument(scope, props.context);
  const walkthroughTitle = useWalkthroughTabTitle(scope, props.context);
  useAtomMount(
    firstDocumentTitleOwner({
      worktreeId: props.worktree.id,
      title: walkthroughTitle,
    }),
  );
  const firstDocument: FirstDocument = {
    pending: worktreeFirstDocument.pending,
    guided: worktreeFirstDocument.guided,
  };
  return (
    <ReviewWorkspace
      {...props}
      review={ReviewDocument}
      changesNavigation={
        worktreeFirstDocument.guided ? WalkthroughIndex : ReviewIndex
      }
      walkthroughCode={WalkthroughCodeDocument}
      firstDocument={firstDocument}
    />
  );
}
