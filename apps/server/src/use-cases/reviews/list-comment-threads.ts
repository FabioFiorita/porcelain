import type {
  CommentThreadScope,
  ListCommentThreadsResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  CheckWorktreeAccessService,
  ListCommentThreadsService,
} from '@porcelain/reviews/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ListCommentThreadsUseCase {
  private readonly checkWorktreeAccess: CheckWorktreeAccessService;
  private readonly listCommentThreads: ListCommentThreadsService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktreeAccess: CheckWorktreeAccessService,
    listCommentThreads: ListCommentThreadsService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktreeAccess = checkWorktreeAccess;
    this.listCommentThreads = listCommentThreads;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: WorktreeParams & { scope?: CommentThreadScope | undefined },
    context: OperationContext,
  ): Promise<ListCommentThreadsResponse> {
    const { worktreeId, scope } = input;
    return this.lanes.run(
      this.laneKeys.worktree(worktreeId),
      'read',
      async ({ signal }) => {
        await this.checkWorktreeAccess.execute(
          { worktreeId, intent: 'read' },
          signal,
        );
        return this.listCommentThreads.execute({ worktreeId, scope });
      },
      { callerSignal: context.signal },
    );
  }
}
