import { Context, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
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
      const store = yield* WalkthroughStore;
      return {
        execute: Effect.fn('ReadProjectWalkthroughsService.execute')(
          function* (input: {
            projectId: string;
            worktreeIds: readonly string[];
          }) {
            const settings = yield* store.readSettings(input.projectId);
            const titles = yield* store.readTitles(input.projectId);
            const runs = yield* Effect.forEach(input.worktreeIds, (id) =>
              store.read(id),
            );
            return { settings, titles, runs };
          },
        ),
      };
    }),
  );
}
