import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type {
  ListCommentThreadsQuery,
  ListCommentThreadsResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ListCommentThreadsService } from '@porcelain/reviews/services';

export class ListCommentThreadsUseCase {
  private readonly access: WorktreeAccess;
  private readonly listCommentThreads: ListCommentThreadsService;

  constructor(
    access: WorktreeAccess,
    listCommentThreads: ListCommentThreadsService,
  ) {
    this.access = access;
    this.listCommentThreads = listCommentThreads;
  }

  execute(
    input: WorktreeParams & ListCommentThreadsQuery,
  ): Effect.Effect<ListCommentThreadsResponse, WorktreeAccessFailure> {
    return Effect.gen({ self: this }, function* () {
      const { worktreeId } = input;
      return yield* this.access.reviews(worktreeId, 'read', () =>
        Effect.gen({ self: this }, function* () {
          return yield* this.listCommentThreads.execute(input);
        }),
      );
    });
  }
}
