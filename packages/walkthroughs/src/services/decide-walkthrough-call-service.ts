import { Context, Effect, Layer } from 'effect';
import { ReadWalkthroughTargetService } from './read-walkthrough-target-service.ts';
import type { WalkthroughTargetNotFoundError } from '../errors/walkthrough-target-not-found-error.ts';
import { WalkthroughCallNotFoundError } from '../errors/walkthrough-call-not-found-error.ts';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import type { CallDecider, CallTarget } from '../models/decision.ts';
import { isDecisionAllowed } from '../rules/decisions.ts';

export class DecideWalkthroughCallService extends Context.Service<
  DecideWalkthroughCallService,
  {
    readonly execute: (
      input: CallTarget & {
        decision:
          | {
              option: string | undefined;
              decidedBy: CallDecider;
              decidedAt: string;
            }
          | undefined;
      },
    ) => Effect.Effect<
      void,
      WalkthroughTargetNotFoundError | WalkthroughCallNotFoundError
    >;
  }
>()('@porcelain/walkthroughs/DecideWalkthroughCallService') {
  static readonly layer = Layer.effect(
    DecideWalkthroughCallService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      const target = yield* ReadWalkthroughTargetService;
      return {
        execute: Effect.fn('DecideWalkthroughCallService.execute')(
          function* (input) {
            const { target: run } = yield* target.execute(input);
            if (
              run.state.status !== 'ready' ||
              !isDecisionAllowed(
                run.state.content.stops,
                input.step,
                input.call,
                input.decision?.option,
              )
            )
              return yield* new WalkthroughCallNotFoundError();
            yield* store.saveDecision(
              {
                worktreeId: input.worktreeId,
                runId: input.runId,
                step: input.step,
                call: input.call,
              },
              input.decision && {
                ...(input.decision.option === undefined
                  ? {}
                  : { option: input.decision.option }),
                decidedBy: input.decision.decidedBy,
                decidedAt: input.decision.decidedAt,
              },
            );
          },
        ),
      };
    }),
  );
}
