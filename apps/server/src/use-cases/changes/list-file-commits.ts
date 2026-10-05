import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type { GitIoFailure } from '../../ports/git-io-failure.ts';
import type { ListFileCommitsService } from '@porcelain/changes/services';
import type {
  ListFileCommitsQuery,
  ListFileCommitsResponse,
} from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';

export class ListFileCommitsUseCase {
  private readonly access: WorktreeAccess;
  private readonly listFileCommits: ListFileCommitsService<GitIoFailure>;

  constructor(
    access: WorktreeAccess,
    listFileCommits: ListFileCommitsService<GitIoFailure>,
  ) {
    this.access = access;
    this.listFileCommits = listFileCommits;
  }

  execute(
    input: WorktreeParams & ListFileCommitsQuery,
  ): Effect.Effect<
    ListFileCommitsResponse,
    WorktreeAccessFailure | GitIoFailure
  > {
    const { worktreeId, path, limit } = input;
    return this.access.read(worktreeId, () =>
      Effect.gen({ self: this }, function* () {
        const listed = yield* this.listFileCommits.execute({
          worktreeId,
          path,
          limit,
        });
        return listed;
      }),
    );
  }
}
