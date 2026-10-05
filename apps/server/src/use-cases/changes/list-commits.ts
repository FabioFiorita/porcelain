import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type { GitIoFailure } from '../../ports/git-io-failure.ts';
import type { ListCommitsService } from '@porcelain/changes/services';
import type {
  ListCommitsQuery,
  ListCommitsResponse,
} from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';

export class ListCommitsUseCase {
  private readonly access: WorktreeAccess;
  private readonly listCommits: ListCommitsService<GitIoFailure>;

  constructor(
    access: WorktreeAccess,
    listCommits: ListCommitsService<GitIoFailure>,
  ) {
    this.access = access;
    this.listCommits = listCommits;
  }

  execute(
    input: WorktreeParams & ListCommitsQuery,
  ): Effect.Effect<ListCommitsResponse, WorktreeAccessFailure | GitIoFailure> {
    const { worktreeId, limit, after, tip } = input;
    return this.access.read(worktreeId, () =>
      Effect.gen({ self: this }, function* () {
        const page = yield* this.listCommits.execute({
          worktreeId,
          limit,
          after,
          tip,
        });
        return page;
      }),
    );
  }
}
