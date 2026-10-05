import type { ListWorktreePathsResponse } from '@porcelain/contracts/files';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ListWorktreePathsService } from '@porcelain/files/services';
import type { DirectoryTooLargeError } from '@porcelain/files/errors';
import type { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';

export class ListWorktreePathsUseCase {
  private readonly access: WorktreeAccess;
  private readonly listWorktreePaths: ListWorktreePathsService;

  constructor(
    access: WorktreeAccess,
    listWorktreePaths: ListWorktreePathsService,
  ) {
    this.access = access;
    this.listWorktreePaths = listWorktreePaths;
  }

  execute(
    input: WorktreeParams,
  ): Effect.Effect<
    ListWorktreePathsResponse,
    WorktreeAccessFailure | DirectoryTooLargeError
  > {
    return this.access.read(input.worktreeId, (worktree) =>
      this.listWorktreePaths.execute({ ...input, worktreeId: worktree.id }),
    );
  }
}
