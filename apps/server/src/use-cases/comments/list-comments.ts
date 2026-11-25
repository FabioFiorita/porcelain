import { Context, Effect, Layer } from 'effect';
import type { GitIoFailure } from '@porcelain/git/errors';
import { ReadWorktreeStatusService } from '@porcelain/changes/services';
import { ReadTextFileService } from '@porcelain/files/services';
import { DraftCommentStore } from '@porcelain/reviews/ports';
import { ListDraftCommentsService } from '@porcelain/reviews/services';
import type { CommentsResponse } from '@porcelain/contracts/comments';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { readCommentsView } from '../../runtime/read-comments-view.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';

export class ListCommentsUseCase extends Context.Service<
  ListCommentsUseCase,
  {
    readonly execute: (
      input: WorktreeParams,
    ) => Effect.Effect<CommentsResponse, WorktreeAccessFailure | GitIoFailure>;
  }
>()('@porcelain/server/ListCommentsUseCase') {
  static readonly layer = Layer.effect(
    ListCommentsUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const capabilities = {
        status: yield* ReadWorktreeStatusService,
        texts: yield* ReadTextFileService,
        list: yield* ListDraftCommentsService,
        store: yield* DraftCommentStore,
      };
      return {
        execute: Effect.fn('ListCommentsUseCase.execute')(function* (input) {
          return yield* access.reviews(input.worktreeId, 'read', () =>
            readCommentsView(capabilities, input.worktreeId),
          );
        }),
      };
    }),
  );
}
