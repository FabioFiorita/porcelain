import { useAtom } from '@effect/atom-react';
import { Cause, Exit } from 'effect';
import { reviewedCommands, toggleLayerMark } from '@porcelain/client/reviews';
import {
  bulkReportText,
  markAllPlan,
  reviewErrorMessage,
  type ReviewableItem,
  type ReviewNotice,
  type ReviewScope,
  WORKTREE_RANGE,
} from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';

type Decision = { layerId: string; fingerprint: string };

export function useCompleteDecision(
  scope: ReviewScope,
  context: ConnectionContext,
  notify: (notice: ReviewNotice) => void,
) {
  const [fileMarks, markFiles] = useAtom(
    reviewedCommands({
      scope,
      connection: context.connection,
      range: WORKTREE_RANGE,
    }).bulk,
    { mode: 'promiseExit' },
  );
  const [decisionMark, setDecisionMark] = useAtom(
    toggleLayerMark({ scope, connection: context.connection }),
    { mode: 'promiseExit' },
  );
  const fail = (title: string, description: string) => {
    notify({ title, description, type: 'error' });
    return false;
  };
  const markEveryFile = async (files: readonly ReviewableItem[]) => {
    const plan = markAllPlan(files);
    if (plan.unmarking || plan.blocked) return true;
    const exit = await markFiles({ kind: 'mark', entries: plan.entries });
    if (Exit.isFailure(exit))
      return fail(
        'Could not mark the files reviewed',
        reviewErrorMessage(Cause.squash(exit.cause)),
      );
    const report = exit.value.kind === 'mark' ? exit.value.report : null;
    return report && report.failed.length > 0
      ? fail(
          'Some files changed before they were marked',
          bulkReportText(report),
        )
      : true;
  };
  const recordDecision = async (decision: Decision, reviewed: boolean) => {
    const exit = await setDecisionMark({ ...decision, reviewed });
    return Exit.isFailure(exit)
      ? fail(
          'Could not update the decision',
          reviewErrorMessage(Cause.squash(exit.cause)),
        )
      : true;
  };
  return {
    pending: fileMarks.waiting || decisionMark.waiting,
    complete(input: {
      files: readonly ReviewableItem[];
      decision?: Decision & { reviewed: boolean };
      onDone?: () => void;
    }) {
      void (async () => {
        if (!(await markEveryFile(input.files))) return;
        if (
          input.decision &&
          !input.decision.reviewed &&
          !(await recordDecision(input.decision, false))
        )
          return;
        input.onDone?.();
      })();
    },
    reopen(decision: Decision) {
      void recordDecision(decision, true);
    },
  };
}
