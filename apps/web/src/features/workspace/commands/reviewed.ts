import { useAtom, useAtomSet } from '@effect/atom-react';
import { Cause, Exit, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { reviewedCommands } from '@porcelain/client/changes';
import {
  reviewErrorMessage,
  markAllPlan,
  completionRefusal,
  type BulkReviewReport,
  type ReviewableItem,
  type ReviewScope,
} from '@porcelain/client/changes/rules';
import {
  type ReviewNotice,
  type ReviewRange,
  reviewToggle,
  type ReviewToggleTarget,
  WORKTREE_RANGE,
} from '@porcelain/client/changes/rules';
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
  const command = reviewedCommands({
    scope,
    connection: context.connection,
    range,
  }).bulk;
  const [result, start] = useAtom(command);
  const submit = useAtomSet(command, { mode: 'promiseExit' });
  const completed = Option.getOrUndefined(AsyncResult.value(result));
  return {
    result,
    submit,
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

export function useToggleStepReviewed(
  scope: ReviewScope,
  context: ConnectionContext,
  range: ReviewRange,
  branch: readonly ReviewableItem[],
  worktree: readonly ReviewableItem[],
  notify: (notice: ReviewNotice | { title: string; type: 'success' }) => void,
) {
  const branchPlan = markAllPlan(branch);
  const worktreePlan = markAllPlan(worktree);
  const branchCommand = useMarkAllReviewed(scope, context, range);
  const worktreeCommand = useMarkAllReviewed(scope, context);
  const entries = [...branch, ...worktree];
  const reviewed =
    entries.length > 0 &&
    entries.every((entry) => entry.reviewStatus === 'reviewed');
  const pending =
    branchCommand.result.waiting || worktreeCommand.result.waiting;
  const disabled = pending || (branchPlan.blocked && worktreePlan.blocked);
  const toggle = () => {
    if (disabled) return;
    const operations = [
      { entries: branch, plan: branchPlan, command: branchCommand },
      { entries: worktree, plan: worktreePlan, command: worktreeCommand },
    ]
      .filter((group) => group.entries.length > 0)
      .map((group) =>
        group.command.submit(
          reviewed
            ? { kind: 'unmark', paths: group.plan.reviewedPaths }
            : { kind: 'mark', entries: group.entries },
        ),
      );
    void Promise.all(operations).then((results) => {
      const failure = results.find(Exit.isFailure);
      if (failure) {
        notify({
          title: 'Could not update review',
          description: reviewErrorMessage(Cause.squash(failure.cause)),
          type: 'error',
        });
        return;
      }
      const report: BulkReviewReport = { marked: [], skipped: [], failed: [] };
      for (const result of results) {
        if (Exit.isSuccess(result) && result.value.kind === 'mark') {
          report.marked.push(...result.value.report.marked);
          report.skipped.push(...result.value.report.skipped);
          report.failed.push(...result.value.report.failed);
        }
      }
      notify(
        completionRefusal(report) ?? {
          title: reviewed ? 'Step marked unreviewed' : 'Step marked reviewed',
          type: 'success',
        },
      );
    });
  };

  return { reviewed, disabled, toggle };
}
