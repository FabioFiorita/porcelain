import { useRouter } from 'expo-router';
import { ErrorState } from '../../../components/ui/error-state';
import type { Workspace } from '../../projects/index';
import { reviewParams } from '../../workspace/index';
import { useBranchFileList, useWalkthroughFiles } from '../queries/walkthrough';
import { fileComparison } from '../rules/file-comparison';

export function useChangedFileOpening(workspace: Workspace) {
  const router = useRouter();
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
          if (comparison)
            router.push({
              pathname: '/review-file',
              params: { ...reviewParams(workspace.key, comparison), path },
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
