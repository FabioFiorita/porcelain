import { Clock, Context, DateTime, Effect, Layer } from 'effect';
import { DraftCommentNotFoundError } from '../errors/draft-comment-not-found-error.ts';
import { DraftCommentPublishedError } from '../errors/draft-comment-published-error.ts';
import { DraftCommentStore } from '../ports/draft-comment-store.ts';

export class EditDraftCommentService extends Context.Service<
  EditDraftCommentService,
  {
    readonly execute: (input: {
      readonly worktreeId: string;
      readonly id: string;
      readonly text: string | undefined;
    }) => Effect.Effect<
      void,
      DraftCommentNotFoundError | DraftCommentPublishedError
    >;
  }
>()('@porcelain/reviews/EditDraftCommentService') {
  static readonly layer = Layer.effect(
    EditDraftCommentService,
    Effect.gen(function* () {
      const store = yield* DraftCommentStore;
      const clock = yield* Clock.Clock;
      return {
        execute: Effect.fn('EditDraftCommentService.execute')(
          function* (input) {
            const found = yield* store.find(input);
            if (!found) return yield* new DraftCommentNotFoundError();
            if (found.publication.status === 'published')
              return yield* new DraftCommentPublishedError();
            if (input.text === undefined) {
              yield* store.remove(input);
              return;
            }
            if (input.text === found.text) return;
            yield* store.updateText({
              worktreeId: input.worktreeId,
              id: input.id,
              text: input.text,
              updatedAt: DateTime.formatIso(
                DateTime.makeUnsafe(yield* clock.currentTimeMillis),
              ),
            });
          },
        ),
      };
    }),
  );
}
