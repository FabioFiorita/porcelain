import { Context, Effect, Layer } from 'effect';
import type {
  DraftCommentKey,
  DraftCommentView,
} from '../models/draft-comment.ts';
import { DraftCommentStore } from '../ports/draft-comment-store.ts';
import { draftOutdated } from '../rules/draft-comments.ts';

export class ListDraftCommentsService extends Context.Service<
  ListDraftCommentsService,
  {
    readonly execute: (
      input: DraftCommentKey & {
        readonly texts: ReadonlyMap<string, string | undefined>;
      },
    ) => Effect.Effect<readonly DraftCommentView[]>;
  }
>()('@porcelain/reviews/ListDraftCommentsService') {
  static readonly layer = Layer.effect(
    ListDraftCommentsService,
    Effect.gen(function* () {
      const store = yield* DraftCommentStore;
      return {
        execute: Effect.fn('ListDraftCommentsService.execute')(
          function* (input) {
            const stored = yield* store.list(input);
            return stored.map(
              ({ worktreeId: _worktree, branch: _branch, ...comment }) => ({
                ...comment,
                outdated:
                  comment.publication.status === 'draft' &&
                  comment.anchor.kind === 'lines' &&
                  draftOutdated(
                    comment.anchor,
                    input.texts.get(comment.anchor.path),
                  ),
              }),
            );
          },
        ),
      };
    }),
  );
}
