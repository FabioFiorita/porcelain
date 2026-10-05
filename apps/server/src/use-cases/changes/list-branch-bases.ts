import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type { GitIoFailure } from '../../ports/git-io-failure.ts';
import type { ListBranchBasesService } from '@porcelain/changes/services';
import type { ListBranchBasesResponse } from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';

export class ListBranchBasesUseCase {
  private readonly access: WorktreeAccess;
  private readonly listBranchBases: ListBranchBasesService<GitIoFailure>;

  constructor(
    access: WorktreeAccess,
    listBranchBases: ListBranchBasesService<GitIoFailure>,
  ) {
    this.access = access;
    this.listBranchBases = listBranchBases;
  }

  execute(
    input: WorktreeParams,
  ): Effect.Effect<
    ListBranchBasesResponse,
    WorktreeAccessFailure | GitIoFailure
  > {
    const { worktreeId } = input;
    return this.access.read(worktreeId, () =>
      Effect.gen({ self: this }, function* () {
        const bases = yield* this.listBranchBases.execute({ worktreeId });
        return bases;
      }),
    );
  }
}
