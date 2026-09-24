import type {
  RemoveReviewedFileQuery,
  RemoveReviewedFileResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type { RemoveReviewedFileService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class RemoveReviewedFileUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly removeReviewedFile: RemoveReviewedFileService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: CheckWorktreeService,
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
      { worktreeId, purpose: 'writing' },
      context.signal,
    );
    const result = await this.lanes.run(
      this.laneKeys.repository(worktree),
      'write',
      async () => this.removeReviewedFile.execute(input),
      { callerSignal: context.signal },
    );
    this.events.worktreeChanged({ worktreeId, change: 'reviewed' });
    return result;
  }
}
