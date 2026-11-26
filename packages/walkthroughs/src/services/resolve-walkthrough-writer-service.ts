import { Context, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import { WalkthroughModelReader } from '../ports/walkthrough-model-reader.ts';
import type {
  WalkthroughModel,
  WalkthroughWriterChoice,
} from '../models/walkthrough.ts';
import {
  builtInWalkthroughWriter,
  latestWalkthroughWriter,
} from '../rules/walkthrough-writer.ts';
export class ResolveWalkthroughWriterService extends Context.Service<
  ResolveWalkthroughWriterService,
  {
    readonly execute: (input: {
      projectId: string | undefined;
      writer: WalkthroughWriterChoice | undefined;
      models?: readonly WalkthroughModel[] | undefined;
    }) => Effect.Effect<WalkthroughWriterChoice>;
  }
>()('@porcelain/walkthroughs/ResolveWalkthroughWriterService') {
  static readonly layer = Layer.effect(
    ResolveWalkthroughWriterService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      const reader = yield* WalkthroughModelReader;
      const chosen = Effect.fn('ResolveWalkthroughWriterService.chosen')(
        function* (input: {
          projectId: string | undefined;
          writer: WalkthroughWriterChoice | undefined;
        }) {
          if (input.writer) return input.writer;
          if (input.projectId !== undefined) {
            const project = yield* store.readSettings(input.projectId);
            if (project.writer) return project.writer;
          }
          return (yield* store.readDefaultWriter()) ?? builtInWalkthroughWriter;
        },
      );
      return {
        execute: Effect.fn('ResolveWalkthroughWriterService.execute')(
          function* (input) {
            const writer = yield* chosen(input);
            if (writer.latest === undefined) return writer;
            return latestWalkthroughWriter(
              writer,
              input.models ?? (yield* reader.read()),
            );
          },
        ),
      };
    }),
  );
}
