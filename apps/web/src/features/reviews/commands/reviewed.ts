import { useMutation, useQueryClient } from '@tanstack/react-query';
import { asMutation, operationMutation } from '@/shared/query/mutation';
import { reviewClock } from '@/shared/adapters/review-clock';
import { reviewedCommands } from '@porcelain/client/reviews';
import {
  reviewErrorMessage,
  type ReviewScope,
} from '@porcelain/client/reviews/rules';
import {
  type MarkReviewedInput,
  type ReviewableItem,
  type ReviewNotice,
  type ReviewRange,
  reviewToggle,
  type ReviewToggleTarget,
  visibleBulkReport,
  WORKTREE_RANGE,
} from '@porcelain/client/reviews/rules';
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
  const mutation = useMutation(
    operationMutation(commands.set, context.connection),
  );
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
  const mutation = useMutation(
    operationMutation(commands.remove, context.connection),
  );
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
  const bulk = useMutation(
    operationMutation(commands.markAll, context.connection),
  );
  const unmark = useMutation(
    operationMutation(commands.unmarkAll, context.connection),
  );
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
