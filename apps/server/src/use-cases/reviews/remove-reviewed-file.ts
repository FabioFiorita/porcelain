import type {
  RemoveReviewedFileQuery,
  RemoveReviewedFileResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  CheckWorktreeAccessService,
  RemoveReviewedFileService,
} from '@porcelain/reviews/services';
import type { EventPublisher } from '../../runtime/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class RemoveReviewedFileUseCase {
  private readonly checkWorktreeAccess: CheckWorktreeAccessService;
  private readonly removeReviewedFile: RemoveReviewedFileService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktreeAccess: CheckWorktreeAccessService,
    removeReviewedFile: RemoveReviewedFileService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktreeAccess = checkWorktreeAccess;
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
    const result = await this.lanes.run(
      this.laneKeys.worktree(worktreeId),
      'write',
      async ({ signal }) => {
        await this.checkWorktreeAccess.execute(
          { worktreeId, intent: 'write' },
          signal,
        );
        return this.removeReviewedFile.execute(input);
      },
      { callerSignal: context.signal },
    );
    this.events.worktreeChanged(worktreeId, 'reviewed');
    return result;
  }
}
