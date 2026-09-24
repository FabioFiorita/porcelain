import type { ListReviewedFilesResponse } from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { CheckWorktreeService } from '@porcelain/files/services';
import type { ListReviewedFilesService } from '@porcelain/reviews/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ListReviewedFilesUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly listReviewedFiles: ListReviewedFilesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeService,
    listReviewedFiles: ListReviewedFilesService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.listReviewedFiles = listReviewedFiles;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: WorktreeParams,
    context: OperationContext,
  ): Promise<ListReviewedFilesResponse> {
    const { worktreeId } = input;
    return this.lanes.run(
      this.laneKeys.worktree(worktreeId),
      'read',
      async ({ signal }) => {
        await this.checkWorktree.execute(
          { worktreeId, purpose: 'reading' },
          signal,
        );
        return this.listReviewedFiles.execute({ worktreeId });
      },
      { callerSignal: context.signal },
    );
  }
}
