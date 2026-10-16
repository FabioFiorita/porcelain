import { Cause, Effect, Exit, Option } from 'effect';
import { Atom, type AsyncResult } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import {
  bulkReportText,
  WORKTREE_RANGE,
  type ReviewableItem,
  type ReviewNotice,
} from '../rules/reviewed.ts';
import { reviewErrorMessage } from '../rules/review.ts';
import { reviewedCommands } from './reviewed.ts';
import { setLayerMark, type SetLayerMarkInput } from './layer-marks.ts';

type Decision = Omit<SetLayerMarkInput, 'kind'>;
type Complete = {
  files: readonly ReviewableItem[];
  decision?: Decision & { reviewed: boolean };
};
type Input =
  | ({ kind: 'complete' } & Complete)
  | { kind: 'reopen'; decision: Decision };

export const completeDecision = Atom.family(
  (input: { connection: RuntimeConnection; scope: WorktreeScope }) => {
    const files = reviewedCommands({ ...input, range: WORKTREE_RANGE }).bulk;
    const decision = setLayerMark(input);
    return Atom.fn((action: Input, get) =>
      Effect.gen(function* () {
        const target = action.decision;
        if (action.kind === 'complete') {
          const result = yield* get
            .setResult(files, { kind: 'mark', entries: action.files })
            .pipe(
              Effect.mapError((error): ReviewNotice => ({
                title: 'Could not mark the files reviewed',
                description: reviewErrorMessage(error),
                type: 'error',
              })),
            );
          if (
            result.kind === 'mark' &&
            (result.report.failed.length > 0 ||
              result.report.skipped.some(
                (entry) => entry.reason === 'not-fingerprintable',
              ))
          )
            return yield* Effect.fail<ReviewNotice>({
              title: 'Some files changed before they were marked',
              description: bulkReportText(result.report),
              type: 'error',
            });
          if (!action.decision || action.decision.reviewed) return;
        }
        if (!target) return;
        yield* get
          .setResult(decision, {
            ...target,
            kind: action.kind === 'reopen' ? 'unmark' : 'mark',
          })
          .pipe(
            Effect.mapError((error): ReviewNotice => ({
              title: 'Could not update the decision',
              description: reviewErrorMessage(error),
              type: 'error',
            })),
          );
      }),
    );
  },
);

export function decisionCompletionBinding(
  [result, submit]: readonly [
    AsyncResult.AsyncResult<void, ReviewNotice>,
    (input: Input | Atom.Reset) => Promise<Exit.Exit<void, ReviewNotice>>,
  ],
  notify: (notice: ReviewNotice) => void,
) {
  const send = (input: Input, onDone?: () => void) => {
    void submit(input).then((exit) => {
      if (Exit.isSuccess(exit)) onDone?.();
      else
        notify(
          Option.getOrElse(Cause.findErrorOption(exit.cause), () => ({
            title: 'Could not update the decision',
            description: reviewErrorMessage(Cause.squash(exit.cause)),
            type: 'error' as const,
          })),
        );
    });
  };
  return {
    pending: result.waiting,
    complete({ onDone, ...input }: Complete & { onDone?: () => void }) {
      send({ ...input, kind: 'complete' }, onDone);
    },
    reopen(decision: Decision) {
      send({ kind: 'reopen', decision });
    },
  };
}
