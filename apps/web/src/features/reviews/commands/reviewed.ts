import { useAtom, useAtomSet } from '@effect/atom-react';
import { Cause, Exit, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { reviewedCommands } from '@porcelain/client/reviews';
import {
  reviewErrorMessage,
  type ReviewScope,
  type ReviewNotice,
  type ReviewRange,
  reviewToggle,
  type ReviewToggleTarget,
  WORKTREE_RANGE,
} from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';

export function useMarkReviewed(
  scope: ReviewScope,
  context: ConnectionContext,
  range: ReviewRange = WORKTREE_RANGE,
) {
  const command = reviewedCommands({
    scope,
    connection: context.connection,
    range,
  }).set;
  const [result, submit] = useAtom(command, { mode: 'promiseExit' });
  return { result, submit, start: useAtomSet(command) };
}
export function useUnmarkReviewed(
  scope: ReviewScope,
  context: ConnectionContext,
  range: ReviewRange = WORKTREE_RANGE,
) {
  const command = reviewedCommands({
    scope,
    connection: context.connection,
    range,
  }).remove;
  const [result, submit] = useAtom(command, { mode: 'promiseExit' });
  return { result, submit, start: useAtomSet(command) };
}
export function useMarkAllReviewed(
  scope: ReviewScope,
  context: ConnectionContext,
  range: ReviewRange = WORKTREE_RANGE,
) {
  const [result, start] = useAtom(
    reviewedCommands({ scope, connection: context.connection, range }).bulk,
  );
  const completed = Option.getOrUndefined(AsyncResult.value(result));
  return {
    result,
    report:
      !result.waiting && completed?.kind === 'mark' ? completed.report : null,
    start,
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
      const toggle = reviewToggle(
        target,
        mark.result.waiting || unmark.result.waiting,
      );
      if (!toggle) return;
      const operation =
        toggle.kind === 'unmark'
          ? unmark.submit(toggle.path)
          : mark.submit(toggle.input);
      void operation.then((exit) => {
        if (Exit.isFailure(exit))
          notify({
            title: 'Could not update review',
            description: reviewErrorMessage(Cause.squash(exit.cause)),
            type: 'error',
          });
      });
    },
  };
}
