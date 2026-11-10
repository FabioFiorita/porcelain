import { Context, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import type { WalkthroughWriterChoice } from '../models/walkthrough.ts';
import { builtInWalkthroughWriter } from '../rules/walkthrough-writer.ts';
export class ResolveWalkthroughWriterService extends Context.Service<
  ResolveWalkthroughWriterService,
  {
    readonly execute: (input: {
      projectId: string;
      writer: WalkthroughWriterChoice | undefined;
    }) => Effect.Effect<WalkthroughWriterChoice>;
  }
>()('@porcelain/walkthroughs/ResolveWalkthroughWriterService') {
  static readonly layer = Layer.effect(
    ResolveWalkthroughWriterService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      return {
        execute: Effect.fn('ResolveWalkthroughWriterService.execute')(
          function* (input) {
            if (input.writer) return input.writer;
            const project = yield* store.readSettings(input.projectId);
            return (
              project.writer ??
              (yield* store.readDefaultWriter()) ??
              builtInWalkthroughWriter
            );
          },
        ),
      };
    }),
  );
}
