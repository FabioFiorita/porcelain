import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type {
  ListReviewedFilesQuery,
  ListReviewedFilesResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ListReviewedFilesService } from '@porcelain/reviews/services';

export class ListReviewedFilesUseCase {
  private readonly access: WorktreeAccess;
  private readonly listReviewedFiles: ListReviewedFilesService;

  constructor(
    access: WorktreeAccess,
    listReviewedFiles: ListReviewedFilesService,
  ) {
    this.access = access;
    this.listReviewedFiles = listReviewedFiles;
  }

  execute(
    input: WorktreeParams & ListReviewedFilesQuery,
  ): Effect.Effect<ListReviewedFilesResponse, WorktreeAccessFailure> {
    return Effect.gen({ self: this }, function* () {
      const { worktreeId, scope } = input;
      const branch = scope === 'branch' ? input.branch : undefined;
      return yield* this.access.reviews(worktreeId, 'read', () =>
        Effect.gen({ self: this }, function* () {
          return yield* this.listReviewedFiles.execute({
            worktreeId,
            scope,
            branch,
          });
        }),
      );
    });
  }
}
