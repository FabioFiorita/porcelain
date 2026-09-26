import type { ListReviewedFilesResponse } from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ListReviewedFilesService } from '@porcelain/reviews/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class ListReviewedFilesUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly listReviewedFiles: ListReviewedFilesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    listReviewedFiles: ListReviewedFilesService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.listReviewedFiles = listReviewedFiles;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: WorktreeParams,
    context: OperationContext,
  ): Promise<ListReviewedFilesResponse> {
    const { worktreeId } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    return this.lanes.run(
      this.laneKeys.reviews(worktree),
      'read',
      async () => this.listReviewedFiles.execute({ worktreeId }),
      { callerSignal: context.signal },
    );
  }
}
