import type { ListCommentThreadsResponse } from '@porcelain/contracts/reviews';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type { ListCommentThreadsInput } from '@porcelain/reviews/models';
import type { ListCommentThreadsService } from '@porcelain/reviews/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ListCommentThreadsUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly listCommentThreads: ListCommentThreadsService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeService,
    listCommentThreads: ListCommentThreadsService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.listCommentThreads = listCommentThreads;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: ListCommentThreadsInput,
    context: OperationContext,
  ): Promise<ListCommentThreadsResponse> {
    const { worktreeId } = input;
    return this.lanes.run(
      this.laneKeys.worktree(worktreeId),
      'read',
      async ({ signal }) => {
        await this.checkWorktree.execute(
          { worktreeId, purpose: 'reading' },
          signal,
        );
        return this.listCommentThreads.execute(input);
      },
      { callerSignal: context.signal },
    );
  }
}
