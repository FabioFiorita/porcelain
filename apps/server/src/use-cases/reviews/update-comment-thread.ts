import type {
  CommentThreadParams,
  UpdateCommentThreadRequest,
  UpdateCommentThreadResponse,
} from '@porcelain/contracts/reviews';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type { UpdateCommentThreadService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class UpdateCommentThreadUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly updateCommentThread: UpdateCommentThreadService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: CheckWorktreeService,
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
      { worktreeId, purpose: 'writing' },
      context.signal,
    );
    const thread = await this.lanes.run(
      this.laneKeys.repository(worktree),
      'write',
      async () => this.updateCommentThread.execute(input),
      { callerSignal: context.signal },
    );
    this.events.worktreeChanged({ worktreeId, change: 'comments' });
    return thread;
  }
}
