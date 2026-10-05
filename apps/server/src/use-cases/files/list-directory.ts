import type {
  ListDirectoryQuery,
  ListDirectoryResponse,
} from '@porcelain/contracts/files';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  ListDirectoryService,
  ListDirectoryFailure,
} from '@porcelain/files/services';
import type { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';

export class ListDirectoryUseCase {
  private readonly access: WorktreeAccess;
  private readonly listDirectory: ListDirectoryService;

  constructor(access: WorktreeAccess, listDirectory: ListDirectoryService) {
    this.access = access;
    this.listDirectory = listDirectory;
  }

  execute(
    input: WorktreeParams & ListDirectoryQuery,
  ): Effect.Effect<
    ListDirectoryResponse,
    WorktreeAccessFailure | ListDirectoryFailure
  > {
    return this.access.read(input.worktreeId, (worktree) =>
      this.listDirectory.execute({ ...input, worktreeId: worktree.id }),
    );
  }
}
