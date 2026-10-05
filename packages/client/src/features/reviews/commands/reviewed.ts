import type { QueryClient } from '@tanstack/query-core';
import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { Effect } from 'effect';
import { reviewsApi } from '../api.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import type { ReviewClock } from '../ports/review-clock.ts';
import {
  bulkMarkPlan,
  bulkMarkReport,
  inChunks,
  type ReviewRange,
  type ReviewableItem,
} from '../rules/reviewed.ts';
import { REVIEWED_FILE_MARKS } from '@porcelain/contracts/shared';
import { reviewedQueryOptions } from '../queries/reviewed.ts';
import { enqueueReviewed, enqueueReviewedMany } from './reviewed-queue.ts';

export function reviewedCommands(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  client: QueryClient,
  range: ReviewRange,
  clock: ReviewClock,
) {
  const api = reviewsApi(connection);
  const context = {
    connection,
    clock,
    key: reviewedQueryOptions(scope, connection, range).queryKey,
  };
  const request = () => ({ ...scope, ...connection.request(), range });
  const commands = {
    set: (input: { path: string; fingerprint: string }) =>
      enqueueReviewed(
        context,
        client,
        input,
        Effect.gen(function* () {
          const connected = request();
          const result = yield* requestEffect(
            range.kind === 'branch'
              ? api.setReviewedFile({
                  params: { worktreeId: scope.worktreeId },
                  payload: {
                    ...input,
                    reviewed: true,
                    scope: 'branch',
                    base: range.base,
                  },
                })
              : api.setReviewedFile({
                  params: { worktreeId: scope.worktreeId },
                  payload: { ...input, reviewed: true },
                }),
            connected.signal,
          );
          yield* currentAnswerEffect(
            connected.signal,
            result.worktreeId === scope.worktreeId,
          );
          return result;
        }),
      ),
    remove: (path: string) =>
      enqueueReviewed(
        context,
        client,
        { path },
        Effect.gen(function* () {
          const connected = request();
          const result = yield* requestEffect(
            api.removeReviewedFile({
              params: { worktreeId: scope.worktreeId },
              query: {
                path,
                ...(range.kind === 'branch'
                  ? {
                      scope: 'branch',
                      ...(range.branch === undefined
                        ? {}
                        : { branch: range.branch }),
                    }
                  : {}),
              },
            }),
            connected.signal,
          );
          yield* currentAnswerEffect(
            connected.signal,
            result.worktreeId === scope.worktreeId,
          );
          return result;
        }),
      ),
    setAll: (files: { path: string; fingerprint: string }[]) =>
      enqueueReviewedMany(
        context,
        client,
        files,
        Effect.gen(function* () {
          const connected = request();
          const result = yield* requestEffect(
            range.kind === 'branch'
              ? api.setReviewedFiles({
                  params: { worktreeId: scope.worktreeId },
                  payload: { files, scope: 'branch', base: range.base },
                })
              : api.setReviewedFiles({
                  params: { worktreeId: scope.worktreeId },
                  payload: { files },
                }),
            connected.signal,
          );
          yield* currentAnswerEffect(
            connected.signal,
            result.worktreeId === scope.worktreeId,
          );
          return result;
        }),
      ),
    removeAll: (paths: readonly string[]) =>
      enqueueReviewedMany(
        context,
        client,
        paths.map((path) => ({ path })),
        Effect.gen(function* () {
          const connected = request();
          const result = yield* requestEffect(
            api.removeReviewedFiles({
              params: { worktreeId: scope.worktreeId },
              payload: {
                paths: [...paths],
                ...(range.kind === 'branch'
                  ? {
                      scope: 'branch',
                      ...(range.branch === undefined
                        ? {}
                        : { branch: range.branch }),
                    }
                  : {}),
              },
            }),
            connected.signal,
          );
          yield* currentAnswerEffect(
            connected.signal,
            result.worktreeId === scope.worktreeId,
          );
          return result;
        }),
      ),
  };
  return {
    ...commands,
    markAll: (entries: readonly ReviewableItem[]) =>
      Effect.gen(function* () {
        const plan = bulkMarkPlan(entries);
        let report = plan.report;
        for (const files of inChunks(plan.files, REVIEWED_FILE_MARKS)) {
          const response = yield* commands.setAll(files);
          report = bulkMarkReport(report, response);
        }
        return report;
      }),
    unmarkAll: (paths: readonly string[]) =>
      Effect.gen(function* () {
        for (const chunk of inChunks(paths, REVIEWED_FILE_MARKS))
          yield* commands.removeAll(chunk);
      }),
  };
}
