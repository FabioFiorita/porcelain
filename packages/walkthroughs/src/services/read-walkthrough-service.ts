import { Context, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import type { WalkthroughRun } from '../models/walkthrough.ts';
export class ReadWalkthroughService extends Context.Service<
  ReadWalkthroughService,
  {
    readonly execute: (input: {
      worktreeId: string;
      headOid: string | undefined;
    }) => Effect.Effect<WalkthroughRun | undefined>;
  }
>()('@porcelain/walkthroughs/ReadWalkthroughService') {
  static readonly layer = Layer.effect(
    ReadWalkthroughService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      return {
        execute: Effect.fn('ReadWalkthroughService.execute')(function* (input) {
          return yield* store.read(input.worktreeId, input.headOid);
        }),
      };
    }),
  );
}
