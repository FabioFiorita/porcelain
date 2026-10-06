import type { ListReviewedFilesResponse } from '@porcelain/contracts/reviews';
import { REVIEWED_FILE_MARKS } from '@porcelain/contracts/shared';
import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import { ReviewedFilesState, reviewedRuntime } from '../store/reviewed.ts';
import {
  bulkMarkPlan,
  bulkMarkReport,
  inChunks,
  type ReviewRange,
  type ReviewableItem,
  type ReviewedChange,
} from '../rules/reviewed.ts';

type Mark = { path: string; fingerprint: string };
type BulkInput =
  | { kind: 'mark'; entries: readonly ReviewableItem[] }
  | { kind: 'unmark'; paths: readonly string[] };
export const reviewedCommands = Atom.family(
  ({
    connection,
    scope,
    range,
  }: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
    range: ReviewRange;
  }) => {
    const runtime = reviewedRuntime({ connection, scope, range });
    const params = { worktreeId: scope.worktreeId };
    const branch =
      range.kind === 'branch'
        ? { scope: 'branch' as const, branch: range.branch }
        : {};
    function confirm<A extends ListReviewedFilesResponse, E>(
      changes: readonly ReviewedChange[],
      operation: Effect.Effect<A, E>,
    ) {
      return Effect.flatMap(ReviewedFilesState, (state) =>
        state.confirm(changes, operation),
      );
    }
    const set = Effect.fn('Reviews.markFile')(function* (input: Mark) {
      const api = yield* porcelainClient(connection);
      return yield* confirm(
        [input],
        requestEffect(
          range.kind === 'branch'
            ? api.reviews.setReviewedFile({
                params,
                payload: {
                  ...input,
                  reviewed: true,
                  scope: 'branch',
                  base: range.base,
                },
              })
            : api.reviews.setReviewedFile({
                params,
                payload: { ...input, reviewed: true },
              }),
        ),
      );
    });
    const remove = Effect.fn('Reviews.unmarkFile')(function* (path: string) {
      const api = yield* porcelainClient(connection);
      return yield* confirm(
        [{ path }],
        requestEffect(
          api.reviews.removeReviewedFile({
            params,
            query: { path, ...branch },
          }),
        ),
      );
    });
    const setAll = Effect.fn('Reviews.markFiles')(function* (files: Mark[]) {
      const api = yield* porcelainClient(connection);
      return yield* confirm(
        files,
        requestEffect(
          range.kind === 'branch'
            ? api.reviews.setReviewedFiles({
                params,
                payload: { files, scope: 'branch', base: range.base },
              })
            : api.reviews.setReviewedFiles({ params, payload: { files } }),
        ),
      );
    });
    const removeAll = Effect.fn('Reviews.unmarkFiles')(function* (
      paths: readonly string[],
    ) {
      const api = yield* porcelainClient(connection);
      return yield* confirm(
        paths.map((path) => ({ path })),
        requestEffect(
          api.reviews.removeReviewedFiles({
            params,
            payload: { paths: [...paths], ...branch },
          }),
        ),
      );
    });
    return {
      set: runtime.fn(set, { concurrent: true }),
      remove: runtime.fn(remove, { concurrent: true }),
      bulk: runtime.fn(
        Effect.fn('Reviews.reviewFiles')(function* (input: BulkInput) {
          if (input.kind === 'unmark') {
            for (const paths of inChunks(input.paths, REVIEWED_FILE_MARKS))
              yield* removeAll(paths);
            return { kind: 'unmark' } as const;
          }
          const plan = bulkMarkPlan(input.entries);
          let report = plan.report;
          for (const files of inChunks(plan.files, REVIEWED_FILE_MARKS))
            report = bulkMarkReport(report, yield* setAll(files));
          return { kind: 'mark', report } as const;
        }),
        { concurrent: true },
      ),
    };
  },
);
