import type {
  RemoveReviewedFileQuery,
  RemoveReviewedFilesRequest,
  RemoveReviewedFilesResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { RemoveReviewedFilesService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class RemoveReviewedFilesUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly removeReviewedFiles: RemoveReviewedFilesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    removeReviewedFiles: RemoveReviewedFilesService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktree = checkWorktree;
    this.removeReviewedFiles = removeReviewedFiles;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(
    input: WorktreeParams &
      (RemoveReviewedFileQuery | RemoveReviewedFilesRequest),
    context: OperationContext,
  ): Promise<RemoveReviewedFilesResponse> {
    const { worktreeId } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    const result = await this.lanes.run(
      this.laneKeys.reviews(worktree),
      'write',
      async () =>
        this.removeReviewedFiles.execute({
          worktreeId,
          scope: input.scope,
          branch: input.scope === 'branch' ? input.branch : undefined,
          paths: 'paths' in input ? input.paths : [input.path],
        }),
      { callerSignal: context.signal },
    );
    const { removed, ...response } = result;
    if (removed)
      this.events.worktreeChanged({ worktreeId, change: 'reviewed' });
    return response;
  }
}
