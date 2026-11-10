import { Atom } from 'effect/reactivity';
import type { WorktreeSelection } from '../../../shared/api/connection.ts';
import { clientWorktreeRead } from '../../../shared/api/worktree-read.ts';

export const readWalkthrough = Atom.family((selection: WorktreeSelection) =>
  clientWorktreeRead(
    selection,
    ['walkthrough'],
    (api) =>
      api.walkthroughs.readWalkthrough({
        params: { worktreeId: selection.scope.worktreeId },
      }),
    (answer) =>
      answer.walkthrough === undefined ||
      answer.walkthrough.worktreeId === selection.scope.worktreeId,
  ),
);

export const readWalkthroughAsset = Atom.family(
  (selection: WorktreeSelection & { runId: string; assetId: string }) =>
    clientWorktreeRead(
      selection,
      ['walkthrough-asset', selection.runId, selection.assetId],
      (api) =>
        api.walkthroughs.readWalkthroughAsset({
          params: {
            worktreeId: selection.scope.worktreeId,
            runId: selection.runId,
            assetId: selection.assetId,
          },
        }),
    ),
);
