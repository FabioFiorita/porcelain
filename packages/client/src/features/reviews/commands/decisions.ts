import { Cause, Effect, Exit, Option } from 'effect';
import { Atom, type AsyncResult } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import {
  completionRefusal,
  bulkMarkPlan,
  type ReviewableItem,
  type ReviewNotice,
} from '../rules/reviewed.ts';
import { reviewErrorMessage } from '../rules/review.ts';
import { reviewCommands } from './project-reviews.ts';

type Decision = { layerId: string; fingerprint: string };
type Complete = {
  revision: number;
  files: readonly ReviewableItem[];
  decision?: Decision & { reviewed: boolean };
};
type Input =
  | ({ kind: 'complete' } & Complete)
  | { kind: 'reopen'; decision: Decision };

export const completeDecision = Atom.family(
  (input: { connection: RuntimeConnection; reviewId: string }) => {
    const commands = reviewCommands(input);
    return Atom.fn((action: Input, get) =>
      Effect.gen(function* () {
        const target = action.decision;
        if (action.kind === 'complete') {
          const plan = bulkMarkPlan(action.files);
          yield* get
            .setResult(commands.markFiles, {
              revision: action.revision,
              files: plan.files.map((file) => ({
                path: file.path,
                headBlobOid: file.fingerprint,
              })),
            })
            .pipe(
              Effect.mapError((error): ReviewNotice => ({
                title: 'Could not mark the files reviewed',
                description: reviewErrorMessage(error),
                type: 'error',
              })),
            );
          const refusal = completionRefusal({
            ...plan.report,
            marked: plan.files.map((file) => file.path),
          });
          if (refusal) return yield* Effect.fail(refusal);
          if (!action.decision || action.decision.reviewed) return;
        }
        if (!target) return;
        yield* (
          action.kind === 'reopen'
            ? get.setResult(commands.unmark, {
                kind: 'decision',
                layerId: target.layerId,
                fingerprint: target.fingerprint,
              })
            : get.setResult(commands.mark, {
                kind: 'decision',
                revision: action.revision,
                layerId: target.layerId,
                fingerprint: target.fingerprint,
              })
        ).pipe(
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
