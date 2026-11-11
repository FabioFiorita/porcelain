import { useAtom, useAtomValue } from '@effect/atom-react';
import { readProjectPullRequests } from '@porcelain/client/projects';
import {
  startWalkthrough,
  walkthroughStartBinding,
} from '@porcelain/client/walkthroughs';
import type { WalkthroughRun } from '@porcelain/client/walkthroughs/rules';
import type { Workspace } from '../../projects/index';
import { walkthroughSelection } from '../queries/walkthrough';

export function useStartWalkthrough(
  workspace: Workspace,
  displayedRun: WalkthroughRun | undefined,
) {
  const [result, start] = useAtom(
    startWalkthrough(walkthroughSelection(workspace)),
    { mode: 'promiseExit' },
  );
  const pulls = useAtomValue(
    readProjectPullRequests({
      connection: workspace.connection,
      projectId: workspace.scope.projectId,
    }),
  );
  return walkthroughStartBinding([result, start], {
    pulls,
    branch: workspace.worktree.branch ?? undefined,
    displayedRun,
  });
}
