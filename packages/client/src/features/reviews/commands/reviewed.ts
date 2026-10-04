import type { QueryClient } from '@tanstack/query-core';
import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { reviewsApi } from '../api.ts';
import type { ReviewRange, ReviewClock } from '../ports/reviews.ts';
import { reviewedQueryOptions } from '../queries/reviewed.ts';
import { enqueueReviewed, enqueueReviewedMany } from './reviewed-queue.ts';

export function reviewedCommands(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  client: QueryClient,
  range: ReviewRange,
  clock: ReviewClock,
) {
  const api = reviewsApi(connection).reviewed;
  const context = {
    connection,
    clock,
    key: reviewedQueryOptions(scope, connection, range).queryKey,
  };
  const request = () => ({ ...scope, ...connection.request(), range });
  return {
    set: (input: { path: string; fingerprint: string }) =>
      enqueueReviewed(context, client, input, async () => {
        const connected = request();
        const result = await api.set({ ...connected, input });
        assertCurrentAnswer(
          connected.signal,
          result.worktreeId === scope.worktreeId,
        );
        return result;
      }),
    remove: (path: string) =>
      enqueueReviewed(context, client, { path }, async () => {
        const connected = request();
        const result = await api.remove({ ...connected, path });
        assertCurrentAnswer(
          connected.signal,
          result.worktreeId === scope.worktreeId,
        );
        return result;
      }),
    setAll: (files: { path: string; fingerprint: string }[]) =>
      enqueueReviewedMany(context, client, files, async () => {
        const connected = request();
        const result = await api.setAll({ ...connected, input: { files } });
        assertCurrentAnswer(
          connected.signal,
          result.worktreeId === scope.worktreeId,
        );
        return result;
      }),
    removeAll: (paths: readonly string[]) =>
      enqueueReviewedMany(
        context,
        client,
        paths.map((path) => ({ path })),
        async () => {
          const connected = request();
          const result = await api.removeAll({ ...connected, paths });
          assertCurrentAnswer(
            connected.signal,
            result.worktreeId === scope.worktreeId,
          );
          return result;
        },
      ),
  };
}
