import { Context, Effect, Layer } from 'effect';
import type { GitIoFailure } from '@porcelain/git/errors';
import { ReadWorktreeStatusService } from '@porcelain/changes/services';
import { ReadTextFileService } from '@porcelain/files/services';
import type { DraftCommentNotFoundError } from '@porcelain/reviews/errors';
import { DraftCommentStore } from '@porcelain/reviews/ports';
import {
  EditDraftCommentService,
  ListDraftCommentsService,
  SaveDraftCommentService,
} from '@porcelain/reviews/services';
import type {
  AddCommentRequest,
  CommentsResponse,
} from '@porcelain/contracts/comments';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { readCommentsView } from '../../runtime/read-comments-view.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';

type Change =
  | ({ readonly kind: 'add' } & AddCommentRequest)
  | { readonly kind: 'edit'; readonly commentId: string; readonly text: string }
  | { readonly kind: 'delete'; readonly commentId: string };

export class ChangeCommentUseCase extends Context.Service<
  ChangeCommentUseCase,
  {
    readonly execute: (
      input: WorktreeParams & Change,
    ) => Effect.Effect<
      CommentsResponse,
      WorktreeAccessFailure | GitIoFailure | DraftCommentNotFoundError
    >;
  }
>()('@porcelain/server/ChangeCommentUseCase') {
  static readonly layer = Layer.effect(
    ChangeCommentUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const save = yield* SaveDraftCommentService;
      const edit = yield* EditDraftCommentService;
      const events = yield* EventPublisher;
      const capabilities = {
        status: yield* ReadWorktreeStatusService,
        texts: yield* ReadTextFileService,
        list: yield* ListDraftCommentsService,
        store: yield* DraftCommentStore,
      };
      return {
        execute: Effect.fn('ChangeCommentUseCase.execute')(function* (input) {
          const { worktreeId } = input;
          const view = yield* access.reviews(worktreeId, 'write', () =>
            Effect.gen(function* () {
              if (input.kind === 'add') {
                const status = yield* capabilities.status.execute({
                  worktreeId,
                });
                yield* save.execute({
                  worktreeId,
                  branch: status.branch?.name ?? '',
                  headOid: status.headOid ?? '',
                  anchor: input.anchor,
                  text: input.text,
                });
              } else
                yield* edit.execute({
                  worktreeId,
                  id: input.commentId,
                  text: input.kind === 'edit' ? input.text : undefined,
                });
              return yield* readCommentsView(capabilities, worktreeId);
            }),
          );
          yield* events.worktreeChanged({ worktreeId, change: 'comments' });
          return view;
        }),
      };
    }),
  );
}
