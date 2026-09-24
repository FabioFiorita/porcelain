import type {
  CreateCommentThreadRequest,
  CreateCommentThreadResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { CommentWriter } from '@porcelain/reviews/models';
import type {
  CheckWorktreeAccessService,
  CreateCommentThreadService,
} from '@porcelain/reviews/services';
import type { EventPublisher } from '../../runtime/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class CreateCommentThreadUseCase {
  private readonly checkWorktreeAccess: CheckWorktreeAccessService;
  private readonly createCommentThread: CreateCommentThreadService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktreeAccess: CheckWorktreeAccessService,
    createCommentThread: CreateCommentThreadService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktreeAccess = checkWorktreeAccess;
    this.createCommentThread = createCommentThread;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(
    input: WorktreeParams &
      CreateCommentThreadRequest & { writer: CommentWriter },
    context: OperationContext,
  ): Promise<CreateCommentThreadResponse> {
    const { worktreeId } = input;
    const thread = await this.lanes.run(
      this.laneKeys.worktree(worktreeId),
      'write',
      async ({ signal }) => {
        await this.checkWorktreeAccess.execute(
          { worktreeId, intent: 'write' },
          signal,
        );
        return this.createCommentThread.execute(input);
      },
      { callerSignal: context.signal },
    );
    this.events.worktreeChanged(worktreeId, 'comments');
    return [thread];
  }
}
