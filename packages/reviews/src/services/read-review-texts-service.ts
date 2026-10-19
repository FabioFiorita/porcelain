import { Context, Effect, Layer } from 'effect';
import type { ReviewTexts } from '../models/review-evidence.ts';
import { ReviewCodeReader } from '../ports/review-code-reader.ts';

export class ReadReviewTextsService extends Context.Service<
  ReadReviewTextsService,
  {
    readonly execute: (input: {
      commonDirectory: string;
      oid: string;
      paths: readonly string[];
    }) => Effect.Effect<{ texts: ReviewTexts; missing: ReadonlySet<string> }>;
  }
>()('@porcelain/reviews/ReadReviewTextsService') {
  static readonly layer = Layer.effect(
    ReadReviewTextsService,
    Effect.gen(function* () {
      const code = yield* ReviewCodeReader;
      return {
        execute: Effect.fn('ReadReviewTextsService.execute')(function* (input) {
          const texts = new Map<string, string>();
          const missing = new Set<string>();
          for (const path of input.paths) {
            const read = yield* code.readText({
              commonDirectory: input.commonDirectory,
              oid: input.oid,
              path,
            });
            if (read.kind === 'text') texts.set(path, read.text);
            else if (read.kind === 'missing') missing.add(path);
          }
          return { texts, missing };
        }),
      };
    }),
  );
}
