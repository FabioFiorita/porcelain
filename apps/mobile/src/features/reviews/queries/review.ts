import { useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { Atom, AsyncResult } from 'effect/reactivity';
import { readChanges, readBranchChanges } from '@porcelain/client/changes';
import { readReviewedFiles } from '@porcelain/client/reviews';
import type { ReviewWorkspace } from '../adapters/workspace';
import {
  reviewRange,
  type ReviewComparison,
  type ReviewSnapshot,
} from '../rules/comparison';

const snapshots = Atom.family(
  ({
    workspace,
    comparison,
  }: {
    workspace: ReviewWorkspace;
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
  workspace: ReviewWorkspace,
  comparison: ReviewComparison,
) {
  const query = snapshots({ workspace, comparison });
  return { result: useAtomValue(query), refresh: useAtomRefresh(query) };
}

export function useReviewMarks(
  workspace: ReviewWorkspace,
  snapshot: ReviewSnapshot,
) {
  const query = readReviewedFiles({
    connection: workspace.connection,
    scope: workspace.scope,
    range: reviewRange(snapshot),
  });
  return { result: useAtomValue(query), refresh: useAtomRefresh(query) };
}
