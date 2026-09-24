import type {
  ListKnownWorktreesService,
  ListRegisteredProjectsService,
} from '@porcelain/projects/services';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { RefreshWorktreeReviewUseCasePort } from '../../ports/refresh-worktree-review-use-case-port.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class RefreshReviewActivityUseCase {
  private readonly listRegisteredProjects: ListRegisteredProjectsService;
  private readonly listKnownWorktrees: ListKnownWorktreesService;
  private readonly refreshWorktreeReview: RefreshWorktreeReviewUseCasePort;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    listRegisteredProjects: ListRegisteredProjectsService,
    listKnownWorktrees: ListKnownWorktreesService,
    refreshWorktreeReview: RefreshWorktreeReviewUseCasePort,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.listRegisteredProjects = listRegisteredProjects;
    this.listKnownWorktrees = listKnownWorktrees;
    this.refreshWorktreeReview = refreshWorktreeReview;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(context: OperationContext): Promise<void> {
    const { listings } = await this.lanes.run(
      this.laneKeys.inventory(),
      'read',
      async () =>
        this.listKnownWorktrees.execute(this.listRegisteredProjects.execute()),
      { callerSignal: context.signal },
    );
    const refreshed = await Promise.allSettled(
      listings.flatMap((listing) =>
        listing.worktrees
          .filter((worktree) => worktree.available)
          .map((worktree) =>
            this.refreshWorktreeReview.execute(
              { worktreeId: worktree.id },
              context,
            ),
          ),
      ),
    );
    const failed = refreshed.find((result) => result.status === 'rejected');
    if (failed) throw failed.reason;
  }
}
