import { useMutation, useQueryClient } from '@tanstack/react-query';
import { asMutation } from '@/shared/query/mutation';
import { reviewedQueryOptions } from '../queries/reviewed';
import {
  type ReviewChangeItem,
  reviewErrorMessage,
  type ReviewScope,
} from '../rules/review';
import {
  bulkMarkPlan,
  bulkMarkReport,
  type MarkReviewedInput,
  type ReviewNotice,
  type ReviewsContext,
  reviewToggle,
  type ReviewToggleTarget,
  visibleBulkReport,
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
  return {
    ...asMutation(mutation),
    start: (input: MarkReviewedInput) => mutation.mutate(input),
  };
}

export function useUnmarkReviewed(scope: ReviewScope, context: ReviewsContext) {
  const unmarkOne = useUnmarkOne(scope, context);
  const mutation = useMutation({ mutationFn: unmarkOne });
  return {
    ...asMutation(mutation),
    start: (path: string) => mutation.mutate(path),
  };
}

export function useMarkAllReviewed(
  scope: ReviewScope,
  context: ReviewsContext,
) {
  const reviewed = reviewedContext(scope, context);
  const client = useQueryClient();
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
    mutationFn: (paths: readonly string[]) =>
      enqueueReviewedMany(
        reviewed,
        client,
        paths.map((path) => ({ path })),
        async () => {
          const request = reviewed.request();
          const result = await reviewed.api.removeAll({ ...request, paths });
          request.signal.throwIfAborted();
          return result;
        },
      ),
  });
  return {
    report: visibleBulkReport(
      { report: bulk.data, submittedAt: bulk.submittedAt },
      unmark.submittedAt,
    ),
    isPending: bulk.isPending || unmark.isPending,
    error: bulk.error ?? unmark.error,
    markAll: (entries: readonly ReviewChangeItem[]) => bulk.mutate(entries),
    unmarkAll: (paths: readonly string[]) => unmark.mutate(paths),
  };
}

export function useToggleReviewed(
  scope: ReviewScope,
  context: ReviewsContext,
  notify: (notice: ReviewNotice) => void,
) {
  const mark = useMarkReviewed(scope, context);
  const unmark = useUnmarkReviewed(scope, context);
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
