import { Context, Effect, Layer } from 'effect';
import { WalkthroughInventoryReader } from '../ports/walkthrough-inventory-reader.ts';
import type {
  WalkthroughSettings,
  WalkthroughRun,
} from '../models/walkthrough.ts';
export class ReadProjectWalkthroughsService extends Context.Service<
  ReadProjectWalkthroughsService,
  {
    readonly execute: (input: {
      projectId: string;
      worktreeIds: readonly string[];
    }) => Effect.Effect<{
      settings: WalkthroughSettings;
      titles: readonly { branch: string; title: string }[];
      runs: readonly (WalkthroughRun | undefined)[];
    }>;
  }
>()('@porcelain/walkthroughs/ReadProjectWalkthroughsService') {
  static readonly layer = Layer.effect(
    ReadProjectWalkthroughsService,
    Effect.gen(function* () {
      const store = yield* WalkthroughInventoryReader;
      return {
        execute: Effect.fn('ReadProjectWalkthroughsService.execute')(
          function* (input: {
            projectId: string;
            worktreeIds: readonly string[];
          }) {
            return yield* store.readProject(input);
          },
        ),
      };
    }),
  );
}
