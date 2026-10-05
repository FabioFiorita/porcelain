import type {
  ReadFileAssetQuery,
  ReadFileAssetResponse,
} from '@porcelain/contracts/files';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  ReadFileAssetService,
  ReadFileAssetFailure,
} from '@porcelain/files/services';
import type { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';

export class ReadFileAssetUseCase {
  private readonly access: WorktreeAccess;
  private readonly readFileAsset: ReadFileAssetService;

  constructor(access: WorktreeAccess, readFileAsset: ReadFileAssetService) {
    this.access = access;
    this.readFileAsset = readFileAsset;
  }

  execute(
    input: WorktreeParams & ReadFileAssetQuery,
  ): Effect.Effect<
    ReadFileAssetResponse,
    WorktreeAccessFailure | ReadFileAssetFailure
  > {
    return this.access.read(input.worktreeId, (worktree) =>
      this.readFileAsset.execute({ ...input, worktreeId: worktree.id }),
    );
  }
}
