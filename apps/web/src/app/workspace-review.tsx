import {
  ReviewWorkspace,
  ReviewIndex,
  ReviewBoundary,
  firstDocumentTitleOwner,
  type FirstDocument,
  type ReviewWorkspaceProps,
} from '@/features/workspace/index';
import {
  WalkthroughDocument,
  WalkthroughIndex,
  WalkthroughCodeDocument,
  useWalkthroughTabTitle,
  useWorktreeFirstDocument,
} from '@/features/walkthroughs/index';
import { useAtomMount } from '@effect/atom-react';

type Props = Omit<
  ReviewWorkspaceProps,
  'walkthrough' | 'changesNavigation' | 'walkthroughCode' | 'firstDocument'
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
  const worktreeFirstDocument = useWorktreeFirstDocument(
    scope,
    props.context,
    props.search.base,
  );
  const showsWalkthrough = worktreeFirstDocument.name === 'walkthrough';
  const walkthroughTitle = useWalkthroughTabTitle(scope, props.context);
  useAtomMount(
    firstDocumentTitleOwner({
      worktreeId: props.worktree.id,
      title: showsWalkthrough ? walkthroughTitle : undefined,
    }),
  );
  const firstDocument: FirstDocument = {
    title: showsWalkthrough ? 'Walkthrough' : undefined,
    pending: worktreeFirstDocument.pending,
    guided: worktreeFirstDocument.guided,
    companion: worktreeFirstDocument.companion,
  };
  return (
    <ReviewWorkspace
      {...props}
      walkthrough={WalkthroughDocument}
      changesNavigation={
        worktreeFirstDocument.guided ? WalkthroughIndex : ReviewIndex
      }
      walkthroughCode={WalkthroughCodeDocument}
      firstDocument={firstDocument}
    />
  );
}
