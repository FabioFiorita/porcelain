import { Context, Effect, Layer } from 'effect';
import { ReviewGraphReader } from '../ports/review-graph-reader.ts';
import type { ModuleGraph } from '../models/review-system.ts';
export class ReadReviewGraphService extends Context.Service<
  ReadReviewGraphService,
  {
    readonly execute: (input: {
      commonDirectory: string;
      oid: string;
    }) => Effect.Effect<ModuleGraph | undefined>;
  }
>()('@porcelain/reviews/ReadReviewGraphService') {
  static readonly layer = Layer.effect(
    ReadReviewGraphService,
    Effect.gen(function* () {
      const reader = yield* ReviewGraphReader;
      return {
        execute: Effect.fn('ReadReviewGraphService.execute')(function* (input) {
          return yield* reader.read(input);
        }),
      };
    }),
  );
}
