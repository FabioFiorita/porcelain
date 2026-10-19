import { Context, Effect, Layer } from 'effect';

import type { ReadReviewInput } from '../models/review-management.ts';
import { ReviewNotFoundError } from '../errors/review-not-found-error.ts';
import { ReviewStore } from '../ports/review-store.ts';
import { ReviewCodeReader } from '../ports/review-code-reader.ts';

export class ReadReviewFileService extends Context.Service<
  ReadReviewFileService,
  {
    readonly execute: (
      input: ReadReviewInput & { path: string },
    ) => Effect.Effect<
      | { kind: 'text'; text: string; blobOid: string }
      | { kind: 'missing' }
      | { kind: 'too-large' | 'unsupported'; blobOid: string },
      ReviewNotFoundError
    >;
  }
>()('@porcelain/reviews/ReadReviewFileService') {
  static readonly layer = Layer.effect(
    ReadReviewFileService,
    Effect.gen(function* () {
      const reviews = yield* ReviewStore;
      const code = yield* ReviewCodeReader;
      return {
        execute: Effect.fn('ReadReviewFileService.execute')(function* (input) {
          const review = yield* reviews.read(input);
          if (review === undefined) return yield* new ReviewNotFoundError();
          return yield* code.readText({
            commonDirectory: review.commonDirectory,
            oid: review.headOid,
            path: input.path,
          });
        }),
      };
    }),
  );
}
