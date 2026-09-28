import { useMutation, useQueryClient } from '@tanstack/react-query';
import { asMutation } from '@/shared/query/mutation';
import { reviewedQueryOptions } from '../queries/reviewed';
import type { ReviewChangeItem, ReviewScope } from '../rules/review';
import {
  bulkMarkPlan,
  bulkMarkReport,
  type MarkReviewedInput,
  type ReviewsContext,
} from '../rules/reviewed';
import { enqueueReviewed, enqueueReviewedMany } from './reviewed-queue';

function reviewedContext(scope: ReviewScope, context: ReviewsContext) {
  const { api, connection } = context;
  return {
    api: api.reviews.reviewed,
    key: reviewedQueryOptions(scope, context).queryKey,
    connection,
    request: (signal?: AbortSignal) => ({
      ...scope,
      ...connection.request(signal),
    }),
  };
}

function useUnmarkOne(scope: ReviewScope, context: ReviewsContext) {
  const reviewed = reviewedContext(scope, context);
  const client = useQueryClient();
  return (path: string) =>
    enqueueReviewed(reviewed, client, { path }, async () => {
      const request = reviewed.request();
      const result = await reviewed.api.remove({ ...request, path });
      request.signal.throwIfAborted();
      return result;
    });
}

export function useMarkReviewed(scope: ReviewScope, context: ReviewsContext) {
  const reviewed = reviewedContext(scope, context);
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: MarkReviewedInput) =>
      enqueueReviewed(reviewed, client, input, async () => {
        const request = reviewed.request();
        const result = await reviewed.api.set({
          ...request,
          input: { ...input, reviewed: true },
        });
        request.signal.throwIfAborted();
        return result;
      }),
  });
  return { ...asMutation(mutation), run: mutation.mutate };
}

export function useUnmarkReviewed(scope: ReviewScope, context: ReviewsContext) {
  const unmarkOne = useUnmarkOne(scope, context);
  const mutation = useMutation({ mutationFn: unmarkOne });
  return { ...asMutation(mutation), run: mutation.mutate };
}

export function useMarkAllReviewed(
  scope: ReviewScope,
  context: ReviewsContext,
) {
  const reviewed = reviewedContext(scope, context);
  const client = useQueryClient();
  const unmarkOne = useUnmarkOne(scope, context);
  const bulk = useMutation({
    mutationFn: async (entries: readonly ReviewChangeItem[]) => {
      const { report, files } = bulkMarkPlan(entries);
      if (files.length === 0) return report;
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
      return bulkMarkReport(report, response);
    },
  });
  const unmark = useMutation({
    mutationFn: async (paths: readonly string[]) => {
      for (const path of paths) await unmarkOne(path);
    },
  });
  return {
    report: bulk.submittedAt >= unmark.submittedAt ? (bulk.data ?? null) : null,
    isPending: bulk.isPending || unmark.isPending,
    error: bulk.error ?? unmark.error,
    markAll: (entries: readonly ReviewChangeItem[]) => bulk.mutate(entries),
    unmarkAll: (paths: readonly string[]) => unmark.mutate(paths),
  };
}
