import type { CreateCommentThreadResponse } from '@porcelain/contracts/reviews';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type { CreateCommentThreadInput } from '@porcelain/reviews/models';
import type { CreateCommentThreadService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class CreateCommentThreadUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly createCommentThread: CreateCommentThreadService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: CheckWorktreeService,
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
      { worktreeId, purpose: 'writing' },
      context.signal,
    );
    const thread = await this.lanes.run(
      this.laneKeys.repository(worktree),
      'write',
      async () => this.createCommentThread.execute(input),
      { callerSignal: context.signal },
    );
    this.events.worktreeChanged(worktreeId, 'comments');
    return thread;
  }
}
