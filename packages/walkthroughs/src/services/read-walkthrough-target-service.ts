import { Context, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import type { WalkthroughRun } from '../models/walkthrough.ts';
import type { StoredWalkthroughMessage } from '../models/conversation.ts';
import { WalkthroughTargetNotFoundError } from '../errors/walkthrough-target-not-found-error.ts';
export class ReadWalkthroughTargetService extends Context.Service<
  ReadWalkthroughTargetService,
  {
    readonly execute: (input: {
      worktreeId: string;
      runId: string;
    }) => Effect.Effect<
      {
        target: WalkthroughRun;
        readyRuns: readonly WalkthroughRun[];
        messages: readonly StoredWalkthroughMessage[];
      },
      WalkthroughTargetNotFoundError
    >;
  }
>()('@porcelain/walkthroughs/ReadWalkthroughTargetService') {
  static readonly layer = Layer.effect(
    ReadWalkthroughTargetService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      return {
        execute: Effect.fn('ReadWalkthroughTargetService.execute')(
          function* (input) {
            const runs = yield* store.listReadyRuns(input.worktreeId);
            const index = runs.findIndex((run) => run.id === input.runId);
            const target = runs[index];
            if (
              target === undefined ||
              target.worktreeId !== input.worktreeId ||
              target.state.status !== 'ready'
            )
              return yield* new WalkthroughTargetNotFoundError();
            const readyRuns = runs
              .slice(0, index + 1)
              .filter((run) => run.branch === target.branch);
            const runIds = new Set(readyRuns.map((run) => run.id));
            const messages = (yield* store.listMessages(
              input.worktreeId,
            )).filter((message) => runIds.has(message.runId));
            return { target, readyRuns, messages };
          },
        ),
      };
    }),
  );
}
