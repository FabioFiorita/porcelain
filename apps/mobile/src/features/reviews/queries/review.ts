import type { ReviewComparison } from '../../../shared/rules/review-comparison';
import { useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { Atom, AsyncResult } from 'effect/reactivity';
import { readChanges, readBranchChanges } from '@porcelain/client/changes';
import { readReviewedFiles } from '@porcelain/client/reviews';
import { WORKTREE_RANGE } from '@porcelain/client/reviews/rules';
import type { Workspace } from '../../projects';
import {
  fileReviewLabels,
  reviewRange,
  type ReviewSnapshot,
} from '../rules/comparison';

const snapshots = Atom.family(
  ({
    workspace,
    comparison,
  }: {
    workspace: Pick<Workspace, 'connection' | 'scope'>;
    comparison: ReviewComparison;
  }) => {
    const input = { connection: workspace.connection, scope: workspace.scope };
    const query: Atom.Atom<
      AsyncResult.AsyncResult<
        ReviewSnapshot,
        | Atom.Failure<ReturnType<typeof readChanges>>
        | Atom.Failure<ReturnType<typeof readBranchChanges>>
      >
    > =
      comparison.kind === 'worktree'
        ? Atom.readable(
            (get) =>
              AsyncResult.map(
                get(readChanges(input)),
                (answer): ReviewSnapshot => ({ kind: 'worktree', answer }),
              ),
            (refresh) => refresh(readChanges(input)),
          )
        : Atom.readable(
            (get) =>
              AsyncResult.map(
                get(
                  readBranchChanges({
                    ...input,
                    ...(comparison.base ? { base: comparison.base } : {}),
                  }),
                ),
                (answer): ReviewSnapshot => ({ kind: 'branch', answer }),
              ),
            (refresh) =>
              refresh(
                readBranchChanges({
                  ...input,
                  ...(comparison.base ? { base: comparison.base } : {}),
                }),
              ),
          );
    return query;
  },
);

export function useReviewSnapshot(
  workspace: Pick<Workspace, 'connection' | 'scope'>,
  comparison: ReviewComparison,
) {
  const query = snapshots({ workspace, comparison });
  return { result: useAtomValue(query), refresh: useAtomRefresh(query) };
}

export function useReviewMarks(
  workspace: Workspace,
  snapshot?: ReviewSnapshot,
) {
  const query = readReviewedFiles({
    connection: workspace.connection,
    scope: workspace.scope,
    range: snapshot ? reviewRange(snapshot) : WORKTREE_RANGE,
  });
  return { result: useAtomValue(query), refresh: useAtomRefresh(query) };
}

export function useFileReview(
  workspace: Workspace,
  comparison: ReviewComparison,
) {
  const snapshot = useReviewSnapshot(workspace, comparison);
  const marks = useReviewMarks(
    workspace,
    AsyncResult.isSuccess(snapshot.result) ? snapshot.result.value : undefined,
  );
  const results: readonly AsyncResult.AsyncResult<unknown, unknown>[] = [
    snapshot.result,
    marks.result,
  ];
  return {
    labels: fileReviewLabels(snapshot.result, marks.result),
    unavailable: results.some(AsyncResult.isFailure),
    pending: results.some(
      (result) => AsyncResult.isInitial(result) || result.waiting,
    ),
    refresh: () => {
      snapshot.refresh();
      marks.refresh();
    },
  };
}
