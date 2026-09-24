import type {
  CommentThreadParams,
  ResolveCommentThreadRequest,
  ResolveCommentThreadResponse,
} from '@porcelain/contracts/reviews';
import type { CheckWorktreeService } from '@porcelain/files/services';
import type { UpdateCommentThreadService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ResolveCommentThreadUseCase {
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
    input: CommentThreadParams & ResolveCommentThreadRequest,
    context: OperationContext,
  ): Promise<ResolveCommentThreadResponse> {
    const { worktreeId } = input;
    const thread = await this.lanes.run(
      this.laneKeys.worktree(worktreeId),
      'write',
      async ({ signal }) => {
        await this.checkWorktree.execute(
          { worktreeId, purpose: 'writing' },
          signal,
        );
        return this.updateCommentThread.execute(input);
      },
      { callerSignal: context.signal },
    );
    this.events.worktreeChanged(worktreeId, 'comments');
    return [thread];
  }
}
