import type {
  ReadPreviewAssetsRequest,
  ReadPreviewAssetsResponse,
} from '@porcelain/contracts/files';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ReadPreviewAssetsService } from '@porcelain/files/services';
import type { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';

export class ReadPreviewAssetsUseCase {
  private readonly access: WorktreeAccess;
  private readonly readPreviewAssets: ReadPreviewAssetsService;

  constructor(
    access: WorktreeAccess,
    readPreviewAssets: ReadPreviewAssetsService,
  ) {
    this.access = access;
    this.readPreviewAssets = readPreviewAssets;
  }

  execute(
    input: WorktreeParams & ReadPreviewAssetsRequest,
  ): Effect.Effect<ReadPreviewAssetsResponse, WorktreeAccessFailure> {
    return this.access.read(input.worktreeId, (worktree) =>
      this.readPreviewAssets.execute({ ...input, worktreeId: worktree.id }),
    );
  }
}
