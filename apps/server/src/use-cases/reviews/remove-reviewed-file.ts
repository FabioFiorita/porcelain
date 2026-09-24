import type {
  RemoveReviewedFileQuery,
  RemoveReviewedFileResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { RemoveReviewedFileService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class RemoveReviewedFileUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly removeReviewedFile: RemoveReviewedFileService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    removeReviewedFile: RemoveReviewedFileService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktree = checkWorktree;
    this.removeReviewedFile = removeReviewedFile;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(
    input: WorktreeParams & RemoveReviewedFileQuery,
    context: OperationContext,
  ): Promise<RemoveReviewedFileResponse> {
    const { worktreeId } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    const result = await this.lanes.run(
      this.laneKeys.reviews(worktree),
      'write',
      async () => this.removeReviewedFile.execute(input),
      { callerSignal: context.signal },
    );
    const { removed, ...response } = result;
    if (removed)
      this.events.worktreeChanged({ worktreeId, change: 'reviewed' });
    return response;
  }
}
