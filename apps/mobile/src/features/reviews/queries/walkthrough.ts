import { useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { readLayerMarks, readReviewedFiles } from '@porcelain/client/reviews';
import {
  decisionStates,
  stopDone,
  WORKTREE_RANGE,
  type ReviewResponse,
  type WalkthroughStop,
} from '@porcelain/client/reviews/rules';
import type { Workspace } from '../../projects';
import { reviewFiles, type ReviewSnapshot } from '../rules/comparison';

export function useWalkthroughProgress(
  workspace: Workspace,
  review: ReviewResponse,
  snapshot: Extract<ReviewSnapshot, { kind: 'worktree' }> | undefined,
  publicationSettled: boolean,
) {
  const input = { connection: workspace.connection, scope: workspace.scope };
  const filesQuery = readReviewedFiles({ ...input, range: WORKTREE_RANGE });
  const decisionsQuery = readLayerMarks(input);
  const files = useAtomValue(filesQuery);
  const decisions = useAtomValue(decisionsQuery);
  const refreshFiles = useAtomRefresh(filesQuery);
  const refreshDecisions = useAtomRefresh(decisionsQuery);
  const filesReady = snapshot && AsyncResult.isSuccess(files) && !files.waiting;
  const decisionsReady = AsyncResult.isSuccess(decisions) && !decisions.waiting;
  const items = filesReady ? reviewFiles(snapshot, files.value) : [];
  const states = decisionStates(
    review.layers,
    decisionsReady ? decisions.value : undefined,
  );
  const settled = Boolean(filesReady && decisionsReady && publicationSettled);
  return {
    files,
    decisions,
    refreshFiles,
    refreshDecisions,
    items,
    states,
    settled,
    done: (stop: WalkthroughStop) => settled && stopDone(stop, items, states),
  };
}
