import { REVIEWED_FILE_MARKS } from '@porcelain/contracts/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { asMutation } from '@/shared/query/mutation';
import { reviewClock } from '@/shared/adapters/review-clock';
import { reviewedCommands } from '@porcelain/client/reviews';
import { reviewErrorMessage, type ReviewScope } from '../rules/review';
import {
  bulkMarkPlan,
  bulkMarkReport,
  inChunks,
  type MarkReviewedInput,
  type ReviewableItem,
  type ReviewNotice,
  type ReviewRange,
  reviewToggle,
  type ReviewToggleTarget,
  visibleBulkReport,
  WORKTREE_RANGE,
} from '../rules/reviewed';
import { type ConnectionContext } from '@/shared/workspace/connection';

function useReviewedCommands(
  scope: ReviewScope,
  context: ConnectionContext,
  range: ReviewRange,
) {
  return reviewedCommands(
    scope,
    context.connection,
    useQueryClient(),
    range,
    reviewClock,
  );
}

export function useMarkReviewed(
  scope: ReviewScope,
  context: ConnectionContext,
  range: ReviewRange = WORKTREE_RANGE,
) {
  const commands = useReviewedCommands(scope, context, range);
  const mutation = useMutation({
    mutationFn: commands.set,
  });
  return {
    ...asMutation(mutation),
    start: (input: MarkReviewedInput) => mutation.mutate(input),
  };
}

export function useUnmarkReviewed(
  scope: ReviewScope,
  context: ConnectionContext,
  range: ReviewRange = WORKTREE_RANGE,
) {
  const commands = useReviewedCommands(scope, context, range);
  const mutation = useMutation({ mutationFn: commands.remove });
  return {
    ...asMutation(mutation),
    start: (path: string) => mutation.mutate(path),
  };
}

export function useMarkAllReviewed(
  scope: ReviewScope,
  context: ConnectionContext,
  range: ReviewRange = WORKTREE_RANGE,
) {
  const commands = useReviewedCommands(scope, context, range);
  const bulk = useMutation({
    mutationFn: async (entries: readonly ReviewableItem[]) => {
      const plan = bulkMarkPlan(entries);
      let report = plan.report;
      for (const files of inChunks(plan.files, REVIEWED_FILE_MARKS)) {
        const response = await commands.setAll(files);
        report = bulkMarkReport(report, response);
      }
      return report;
    },
  });
  const unmark = useMutation({
    mutationFn: async (paths: readonly string[]) => {
      for (const chunk of inChunks(paths, REVIEWED_FILE_MARKS))
        await commands.removeAll(chunk);
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
  context: ConnectionContext,
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
