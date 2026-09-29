import type {
  CommentAuthor,
  CommentThreadParams,
  DeleteCommentMessageQuery,
  DeleteCommentMessageResponse,
} from '@porcelain/contracts/reviews';
import type { DeleteCommentMessageService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class DeleteCommentMessageUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly deleteCommentMessage: DeleteCommentMessageService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    deleteCommentMessage: DeleteCommentMessageService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktree = checkWorktree;
    this.deleteCommentMessage = deleteCommentMessage;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(
    input: CommentThreadParams & DeleteCommentMessageQuery & CommentAuthor,
    context: OperationContext,
  ): Promise<DeleteCommentMessageResponse> {
    const { worktreeId } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    const result = await this.lanes.run(
      this.laneKeys.reviews(worktree),
      'write',
      async () => this.deleteCommentMessage.execute(input),
      { callerSignal: context.signal },
    );
    this.events.worktreeChanged({ worktreeId, change: 'comments' });
    return result;
  }
}
