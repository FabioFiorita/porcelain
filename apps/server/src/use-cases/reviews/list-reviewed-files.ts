import type { ListReviewedFilesResponse } from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  CheckWorktreeAccessService,
  ListReviewedFilesService,
} from '@porcelain/reviews/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ListReviewedFilesUseCase {
  private readonly checkWorktreeAccess: CheckWorktreeAccessService;
  private readonly listReviewedFiles: ListReviewedFilesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktreeAccess: CheckWorktreeAccessService,
    listReviewedFiles: ListReviewedFilesService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktreeAccess = checkWorktreeAccess;
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
        await this.checkWorktreeAccess.execute(
          { worktreeId, intent: 'read' },
          signal,
        );
        return this.listReviewedFiles.execute({ worktreeId });
      },
      { callerSignal: context.signal },
    );
  }
}
