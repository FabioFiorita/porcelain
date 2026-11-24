import { fileComparison } from '@porcelain/client/walkthroughs/rules';
import { ErrorState } from '../../../components/ui/error-state';
import type { Workspace } from '../../projects/index';
import { useOpenReviewFile } from '../../workspace/index';
import { useBranchFileList, useWalkthroughFiles } from '../queries/walkthrough';

export function useChangedFileOpening(workspace: Workspace) {
  const openReviewFile = useOpenReviewFile(workspace.key);
  const branch = useBranchFileList(workspace);
  const { worktree } = useWalkthroughFiles(workspace);
  return {
    row: (path: string) => {
      const comparison = fileComparison(
        { branch: branch.files, branchFailed: branch.failed, worktree },
        path,
      );
      return {
        pending: comparison === undefined && !branch.failed,
        disabled: comparison === undefined,
        onPress: () => {
          if (comparison?.kind === 'branch')
            openReviewFile({ path, comparison: { kind: 'branch' } });
          else if (comparison)
            openReviewFile({
              path,
              comparison: { kind: 'worktree' },
              scope: comparison.change?.scope,
            });
        },
      };
    },
    failure:
      branch.files === undefined && branch.failed ? (
        <ErrorState
          message="The changed files could not be read."
          retry={{
            label: 'Read the changes again',
            onPress: branch.retry,
            pending: branch.waiting,
          }}
        />
      ) : null,
  };
}
