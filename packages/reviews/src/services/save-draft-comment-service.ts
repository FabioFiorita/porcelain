import { Clock, Context, DateTime, Effect, Layer } from 'effect';
import { IdSource } from '@porcelain/kernel/ports';
import type {
  DraftCommentAnchor,
  DraftCommentKey,
  StoredDraftComment,
} from '../models/draft-comment.ts';
import { DraftCommentStore } from '../ports/draft-comment-store.ts';

export class SaveDraftCommentService extends Context.Service<
  SaveDraftCommentService,
  {
    readonly execute: (
      input: DraftCommentKey & {
        readonly headOid: string;
        readonly anchor: DraftCommentAnchor;
        readonly text: string;
      },
    ) => Effect.Effect<StoredDraftComment>;
  }
>()('@porcelain/reviews/SaveDraftCommentService') {
  static readonly layer = Layer.effect(
    SaveDraftCommentService,
    Effect.gen(function* () {
      const store = yield* DraftCommentStore;
      const ids = yield* IdSource;
      const clock = yield* Clock.Clock;
      return {
        execute: Effect.fn('SaveDraftCommentService.execute')(function* (input) {
          const now = DateTime.formatIso(
            DateTime.makeUnsafe(yield* clock.currentTimeMillis),
          );
          const comment: StoredDraftComment = {
            id: ids.next(),
            worktreeId: input.worktreeId,
            branch: input.branch,
            headOid: input.headOid,
            anchor: input.anchor,
            text: input.text,
            createdAt: now,
            updatedAt: now,
            publication: { status: 'draft' },
          };
          yield* store.insert(comment);
          return comment;
        }),
      };
    }),
  );
}
