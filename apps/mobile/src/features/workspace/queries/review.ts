import type { ReviewComparison } from '../../../shared/rules/review-comparison';
import { useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { Atom, AsyncResult } from 'effect/reactivity';
import {
  readChanges,
  readBranchChanges,
  readBranchDiffs,
  readChangeDiffWindow,
} from '@porcelain/client/changes';
import {
  selectionKey,
  type DiffContent,
} from '@porcelain/client/changes/rules';
import { Option } from 'effect';
import { changeEntries } from '../rules/changes-page';
import { readReviewedFiles } from '@porcelain/client/reviews';
import { WORKTREE_RANGE } from '@porcelain/client/reviews/rules';
import type { Workspace } from '../../projects/index';
import {
  snapshotChangeMarks,
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
    changes: snapshotChangeMarks(snapshot.result),
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

type ChunkDiffs = AsyncResult.AsyncResult<
  ReadonlyMap<string, DiffContent | undefined>,
  unknown
>;

export const changePageDiffs = Atom.family(
  ({
    workspace,
    comparison,
    keys,
  }: {
    workspace: Pick<Workspace, 'connection' | 'scope'>;
    comparison: ReviewComparison;
    keys: readonly string[];
  }) => {
    const source: { query: Atom.Atom<unknown> | undefined } = {
      query: undefined,
    };
    return Atom.readable(
      (get): ChunkDiffs => {
        const current = chunkDiffs(
          (query) => {
            source.query = query;
            return get(query);
          },
          get(snapshots({ workspace, comparison })),
          workspace,
          keys,
        );
        const previous = Option.getOrUndefined(get.self<ChunkDiffs>());
        if (
          !AsyncResult.isSuccess(current) &&
          !AsyncResult.isFailure(current) &&
          previous &&
          AsyncResult.isSuccess(previous)
        )
          return AsyncResult.success(previous.value, { waiting: true });
        return current;
      },
      (refresh) =>
        refresh(source.query ?? snapshots({ workspace, comparison })),
    );
  },
);

function chunkDiffs(
  get: <A>(query: Atom.Atom<A>) => A,
  snapshot: AsyncResult.AsyncResult<ReviewSnapshot, unknown>,
  workspace: Pick<Workspace, 'connection' | 'scope'>,
  keys: readonly string[],
): ChunkDiffs {
  if (!AsyncResult.isSuccess(snapshot))
    return AsyncResult.map(snapshot, () => new Map());
  const entries = changeEntries(snapshot.value).filter((entry) =>
    keys.includes(entry.key),
  );
  const input = { connection: workspace.connection, scope: workspace.scope };
  if (snapshot.value.kind === 'branch') {
    const { mergeBaseOid, head } = snapshot.value.answer;
    const paths = entries.flatMap((entry) =>
      entry.read.kind === 'branch' ? [[...entry.read.paths]] : [],
    );
    if (!mergeBaseOid || paths.length === 0)
      return AsyncResult.success(new Map());
    return AsyncResult.map(
      get(
        readBranchDiffs({
          ...input,
          input: { baseOid: mergeBaseOid, headOid: head.oid, paths },
        }),
      ),
      (answer) =>
        new Map(
          answer.diffs.map((diff) => [diff.paths.join('\0'), diff.content]),
        ),
    );
  }
  const diffs = entries.flatMap((entry) =>
    entry.read.kind === 'diff' ? [{ entry, read: entry.read }] : [],
  );
  if (diffs.length === 0) return AsyncResult.success(new Map());
  const window = get(
    readChangeDiffWindow({
      ...input,
      statusToken: snapshot.value.answer.statusToken,
      expectedFiles: [
        ...new Map(
          diffs.map(({ entry, read }) => [
            entry.path,
            { path: entry.path, fingerprint: read.fingerprint },
          ]),
        ).values(),
      ],
      selections: diffs.map(({ read }) => read.selection),
    }),
  );
  return AsyncResult.map(
    window.result,
    (contents) =>
      new Map(
        diffs.map(({ entry, read }) => [
          entry.key,
          contents.get(selectionKey(read.selection)),
        ]),
      ),
  );
}
