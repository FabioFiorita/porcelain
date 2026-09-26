import type {
  ListCommentThreadsQuery,
  ListCommentThreadsResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ListCommentThreadsService } from '@porcelain/reviews/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class ListCommentThreadsUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly listCommentThreads: ListCommentThreadsService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    listCommentThreads: ListCommentThreadsService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.listCommentThreads = listCommentThreads;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: WorktreeParams & ListCommentThreadsQuery,
    context: OperationContext,
  ): Promise<ListCommentThreadsResponse> {
    const { worktreeId } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    return this.lanes.run(
      this.laneKeys.reviews(worktree),
      'read',
      async () => this.listCommentThreads.execute(input),
      { callerSignal: context.signal },
    );
  }
}
