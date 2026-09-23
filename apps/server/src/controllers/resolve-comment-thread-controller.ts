import type {
  CommentThreadParams,
  ResolveCommentThreadRequest,
  ResolveCommentThreadResponse,
} from '@porcelain/contracts/reviews';
import type {
  CheckWorktreeAccessService,
  ResolveCommentThreadService,
} from '@porcelain/reviews/services';
import type { EventPublisher } from '../runtime/event-publisher.ts';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class ResolveCommentThreadController {
  private readonly checkWorktreeAccess: CheckWorktreeAccessService;
  private readonly resolveCommentThread: ResolveCommentThreadService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktreeAccess: CheckWorktreeAccessService,
    resolveCommentThread: ResolveCommentThreadService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktreeAccess = checkWorktreeAccess;
    this.resolveCommentThread = resolveCommentThread;
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
        await this.checkWorktreeAccess.execute(
          { worktreeId, intent: 'write' },
          signal,
        );
        return this.resolveCommentThread.execute(input);
      },
      { callerSignal: context.signal },
    );
    this.events.worktreeChanged(worktreeId, 'comments');
    return [thread];
  }
}
