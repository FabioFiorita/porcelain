import { Atom } from 'effect/reactivity';
import type { WorktreeSelection } from '../../../shared/api/connection.ts';
import { clientWorktreeRead } from '../../../shared/api/worktree-read.ts';

export const readWalkthrough = Atom.family(
  (
    selection: WorktreeSelection & {
      excerpt?: { runId: string; step: number; block?: number };
    },
  ) =>
    clientWorktreeRead(
      selection,
      selection.excerpt === undefined
        ? ['walkthrough']
        : [
            'walkthrough-excerpt',
            selection.excerpt.runId,
            selection.excerpt.step,
            selection.excerpt.block ?? 0,
          ],
      (api) =>
        api.walkthroughs.readWalkthrough({
          params: { worktreeId: selection.scope.worktreeId },
          query:
            selection.excerpt === undefined
              ? {}
              : {
                  excerptRunId: selection.excerpt.runId,
                  excerptStep: selection.excerpt.step,
                  excerptBlock: selection.excerpt.block,
                },
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
