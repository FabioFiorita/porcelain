import { Context, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import type { WalkthroughRun } from '../models/walkthrough.ts';
export class ReadWalkthroughService extends Context.Service<
  ReadWalkthroughService,
  {
    readonly execute: (input: {
      worktreeId: string;
      branch: string | undefined;
    }) => Effect.Effect<{
      walkthrough: WalkthroughRun | undefined;
      attempt: WalkthroughRun | undefined;
    }>;
  }
>()('@porcelain/walkthroughs/ReadWalkthroughService') {
  static readonly layer = Layer.effect(
    ReadWalkthroughService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      return {
        execute: Effect.fn('ReadWalkthroughService.execute')(function* (input) {
          const latest = yield* store.read(input.worktreeId, {
            branch: input.branch,
          });
          const ready = (yield* store.listReadyRuns(input.worktreeId)).findLast(
            (run) => run.branch === input.branch,
          );
          return {
            walkthrough:
              latest?.state.status === 'ready' ? latest : (ready ?? latest),
            attempt:
              ready !== undefined &&
              latest !== undefined &&
              latest.state.status !== 'ready' &&
              latest.id !== ready.id
                ? latest
                : undefined,
          };
        }),
      };
    }),
  );
}
