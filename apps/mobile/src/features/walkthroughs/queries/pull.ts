import { useAtomValue } from '@effect/atom-react';
import { readWalkthroughPull } from '@porcelain/client/walkthroughs';
import type { WalkthroughRun } from '@porcelain/client/walkthroughs/rules';
import type { Workspace } from '../../projects/index';

export function useWalkthroughPull(
  workspace: Pick<Workspace, 'connection' | 'scope'>,
  run: Pick<WalkthroughRun, 'branch' | 'pullRequestNumber'>,
) {
  return useAtomValue(
    readWalkthroughPull({
      connection: workspace.connection,
      projectId: workspace.scope.projectId,
      branch: run.branch,
      pullRequestNumber: run.pullRequestNumber,
    }),
  );
}
