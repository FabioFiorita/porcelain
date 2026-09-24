import type { CreateCommentThreadResponse } from '@porcelain/contracts/reviews';
import type { CreateCommentThreadInput } from '@porcelain/reviews/models';
import type { CreateCommentThreadService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';
import type { WorktreeCheck } from '../../runtime/worktree-check.ts';

export class CreateCommentThreadUseCase {
  private readonly checkWorktree: WorktreeCheck;
  private readonly createCommentThread: CreateCommentThreadService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: WorktreeCheck,
    createCommentThread: CreateCommentThreadService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktree = checkWorktree;
    this.createCommentThread = createCommentThread;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(
    input: CreateCommentThreadInput,
    context: OperationContext,
  ): Promise<CreateCommentThreadResponse> {
    const { worktreeId } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    const thread = await this.lanes.run(
      this.laneKeys.reviews(worktree),
      'write',
      async () => this.createCommentThread.execute(input),
      { callerSignal: context.signal },
    );
    this.events.worktreeChanged({ worktreeId, change: 'comments' });
    return thread;
  }
}
