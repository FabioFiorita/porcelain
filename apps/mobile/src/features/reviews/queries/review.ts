import type { ReviewComparison } from '../../../shared/rules/review-comparison';
import { useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { Atom, AsyncResult } from 'effect/reactivity';
import { readChanges, readBranchChanges } from '@porcelain/client/changes';
import { readReviewedFiles } from '@porcelain/client/reviews';
import type { Workspace } from '../../projects';
import { reviewRange, type ReviewSnapshot } from '../rules/comparison';

const snapshots = Atom.family(
  ({
    workspace,
    comparison,
  }: {
    workspace: Workspace;
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
  workspace: Workspace,
  comparison: ReviewComparison,
) {
  const query = snapshots({ workspace, comparison });
  return { result: useAtomValue(query), refresh: useAtomRefresh(query) };
}

export function useReviewMarks(workspace: Workspace, snapshot: ReviewSnapshot) {
  const query = readReviewedFiles({
    connection: workspace.connection,
    scope: workspace.scope,
    range: reviewRange(snapshot),
  });
  return { result: useAtomValue(query), refresh: useAtomRefresh(query) };
}
