import { Context, Effect, Layer } from 'effect';
import type { DraftCommentKey } from '../models/draft-comment.ts';
import { DraftCommentStore } from '../ports/draft-comment-store.ts';
import { outdatedCheckPaths } from '../rules/draft-comments.ts';

export class ListCommentedPathsService extends Context.Service<
  ListCommentedPathsService,
  {
    readonly execute: (
      input: DraftCommentKey,
    ) => Effect.Effect<readonly string[]>;
  }
>()('@porcelain/reviews/ListCommentedPathsService') {
  static readonly layer = Layer.effect(
    ListCommentedPathsService,
    Effect.gen(function* () {
      const store = yield* DraftCommentStore;
      return {
        execute: Effect.fn('ListCommentedPathsService.execute')(
          function* (input) {
            return outdatedCheckPaths(yield* store.list(input));
          },
        ),
      };
    }),
  );
}
