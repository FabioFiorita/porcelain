import type {
  CommentThreadParams,
  UpdateCommentThreadRequest,
  UpdateCommentThreadResponse,
} from '@porcelain/contracts/reviews';
import type { UpdateCommentThreadService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class UpdateCommentThreadUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly updateCommentThread: UpdateCommentThreadService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    updateCommentThread: UpdateCommentThreadService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktree = checkWorktree;
    this.updateCommentThread = updateCommentThread;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(
    input: CommentThreadParams & UpdateCommentThreadRequest,
    context: OperationContext,
  ): Promise<UpdateCommentThreadResponse> {
    const { worktreeId } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    const { thread, changed } = await this.lanes.run(
      this.laneKeys.reviews(worktree),
      'write',
      async () => this.updateCommentThread.execute(input),
      { callerSignal: context.signal },
    );
    if (changed)
      this.events.worktreeChanged({ worktreeId, change: 'comments' });
    return thread;
  }
}
