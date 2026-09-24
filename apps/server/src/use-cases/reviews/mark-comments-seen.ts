import type {
  MarkCommentsSeenRequest,
  MarkCommentsSeenResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  CheckWorktreeAccessService,
  MarkCommentsSeenService,
} from '@porcelain/reviews/services';
import type { EventPublisher } from '../../runtime/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class MarkCommentsSeenUseCase {
  private readonly checkWorktreeAccess: CheckWorktreeAccessService;
  private readonly markCommentsSeen: MarkCommentsSeenService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktreeAccess: CheckWorktreeAccessService,
    markCommentsSeen: MarkCommentsSeenService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktreeAccess = checkWorktreeAccess;
    this.markCommentsSeen = markCommentsSeen;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(
    input: WorktreeParams & MarkCommentsSeenRequest,
    context: OperationContext,
  ): Promise<MarkCommentsSeenResponse> {
    const { worktreeId } = input;
    const result = await this.lanes.run(
      this.laneKeys.worktree(worktreeId),
      'write',
      async ({ signal }) => {
        await this.checkWorktreeAccess.execute(
          { worktreeId, intent: 'write' },
          signal,
        );
        return this.markCommentsSeen.execute(input);
      },
      { callerSignal: context.signal },
    );
    this.events.worktreeChanged(worktreeId, 'comments');
    return result;
  }
}
