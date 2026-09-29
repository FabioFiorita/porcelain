import type {
  CommentAuthor,
  DeleteResolvedCommentsRequest,
  DeleteResolvedCommentsResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { DeleteResolvedCommentsService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class DeleteResolvedCommentsUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly deleteResolvedComments: DeleteResolvedCommentsService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    deleteResolvedComments: DeleteResolvedCommentsService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktree = checkWorktree;
    this.deleteResolvedComments = deleteResolvedComments;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(
    input: WorktreeParams & DeleteResolvedCommentsRequest & CommentAuthor,
    context: OperationContext,
  ): Promise<DeleteResolvedCommentsResponse> {
    const { worktreeId } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    const result = await this.lanes.run(
      this.laneKeys.reviews(worktree),
      'write',
      async () => this.deleteResolvedComments.execute(input),
      { callerSignal: context.signal },
    );
    if (result.deleted.length > 0)
      this.events.worktreeChanged({ worktreeId, change: 'comments' });
    return result;
  }
}
