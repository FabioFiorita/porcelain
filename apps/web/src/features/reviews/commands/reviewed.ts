import { REVIEWED_FILE_MARKS } from '@porcelain/contracts/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { asMutation } from '@/shared/query/mutation';
import { reviewedQueryOptions } from '../queries/reviewed';
import { reviewErrorMessage, type ReviewScope } from '../rules/review';
import {
  bulkMarkPlan,
  bulkMarkReport,
  inChunks,
  type MarkReviewedInput,
  type ReviewableItem,
  type ReviewNotice,
  type ReviewRange,
  type ReviewsContext,
  reviewToggle,
  type ReviewToggleTarget,
  visibleBulkReport,
  WORKTREE_RANGE,
} from '../rules/reviewed';
import { enqueueReviewed, enqueueReviewedMany } from './reviewed-queue';

function reviewedContext(
  scope: ReviewScope,
  context: ReviewsContext,
  range: ReviewRange,
) {
  const { api, connection } = context;
  return {
    api: api.reviews.reviewed,
    key: reviewedQueryOptions(scope, context, range).queryKey,
    connection,
    request: (signal?: AbortSignal) => ({
      ...scope,
      ...connection.request(signal),
      range,
    }),
  };
}

function useUnmarkOne(
  scope: ReviewScope,
  context: ReviewsContext,
  range: ReviewRange,
) {
  const reviewed = reviewedContext(scope, context, range);
  const client = useQueryClient();
  return (path: string) =>
    enqueueReviewed(reviewed, client, { path }, async () => {
      const request = reviewed.request();
      const result = await reviewed.api.remove({ ...request, path });
      request.signal.throwIfAborted();
      return result;
    });
}

export function useMarkReviewed(
  scope: ReviewScope,
  context: ReviewsContext,
  range: ReviewRange = WORKTREE_RANGE,
) {
  const reviewed = reviewedContext(scope, context, range);
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: MarkReviewedInput) =>
      enqueueReviewed(reviewed, client, input, async () => {
        const request = reviewed.request();
        const result = await reviewed.api.set({ ...request, input });
        request.signal.throwIfAborted();
        return result;
      }),
  });
  return {
    ...asMutation(mutation),
    start: (input: MarkReviewedInput) => mutation.mutate(input),
  };
}

export function useUnmarkReviewed(
  scope: ReviewScope,
  context: ReviewsContext,
  range: ReviewRange = WORKTREE_RANGE,
) {
  const unmarkOne = useUnmarkOne(scope, context, range);
  const mutation = useMutation({ mutationFn: unmarkOne });
  return {
    ...asMutation(mutation),
    start: (path: string) => mutation.mutate(path),
  };
}

export function useMarkAllReviewed(
  scope: ReviewScope,
  context: ReviewsContext,
  range: ReviewRange = WORKTREE_RANGE,
) {
  const reviewed = reviewedContext(scope, context, range);
  const client = useQueryClient();
  const bulk = useMutation({
    mutationFn: async (entries: readonly ReviewableItem[]) => {
      const plan = bulkMarkPlan(entries);
      let report = plan.report;
      for (const files of inChunks(plan.files, REVIEWED_FILE_MARKS)) {
        const response = await enqueueReviewedMany(
          reviewed,
          client,
          files,
          async () => {
            const request = reviewed.request();
            const result = await reviewed.api.setAll({
              ...request,
              input: { files },
            });
            request.signal.throwIfAborted();
            return result;
          },
        );
        report = bulkMarkReport(report, response);
      }
      return report;
    },
  });
  const unmark = useMutation({
    mutationFn: async (paths: readonly string[]) => {
      for (const chunk of inChunks(paths, REVIEWED_FILE_MARKS))
        await enqueueReviewedMany(
          reviewed,
          client,
          chunk.map((path) => ({ path })),
          async () => {
            const request = reviewed.request();
            const result = await reviewed.api.removeAll({
              ...request,
              paths: chunk,
            });
            request.signal.throwIfAborted();
            return result;
          },
        );
    },
  });
  return {
    report: visibleBulkReport(
      { report: bulk.data, submittedAt: bulk.submittedAt },
      unmark.submittedAt,
    ),
    isPending: bulk.isPending || unmark.isPending,
    error: bulk.error ?? unmark.error,
    markAll: (entries: readonly ReviewableItem[]) => bulk.mutate(entries),
    unmarkAll: (paths: readonly string[]) => unmark.mutate(paths),
  };
}

export function useToggleReviewed(
  scope: ReviewScope,
  context: ReviewsContext,
  notify: (notice: ReviewNotice) => void,
  range: ReviewRange = WORKTREE_RANGE,
) {
  const mark = useMarkReviewed(scope, context, range);
  const unmark = useUnmarkReviewed(scope, context, range);
  return {
    toggle(target: ReviewToggleTarget | undefined) {
      const toggle = reviewToggle(target, mark.isPending || unmark.isPending);
      if (!toggle) return;
      const operation =
        toggle.kind === 'unmark'
          ? unmark.submit(toggle.path)
          : mark.submit(toggle.input);
      void operation.catch((error: unknown) =>
        notify({
          title: 'Could not update review',
          description: reviewErrorMessage(error),
          type: 'error',
        }),
      );
    },
  };
}
