import type {
  ListKnownWorktreesService,
  ListRegisteredProjectsService,
} from '@porcelain/projects/services';
import type { Logger } from '../../ports/logger.ts';
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
  private readonly logger: Logger;

  constructor(
    listRegisteredProjects: ListRegisteredProjectsService,
    listKnownWorktrees: ListKnownWorktreesService,
    refreshWorktreeReview: RefreshWorktreeReviewUseCasePort,
    lanes: Lanes,
    laneKeys: LaneKeys,
    logger: Logger,
  ) {
    this.listRegisteredProjects = listRegisteredProjects;
    this.listKnownWorktrees = listKnownWorktrees;
    this.refreshWorktreeReview = refreshWorktreeReview;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.logger = logger;
  }

  async execute(context: OperationContext): Promise<void> {
    const { listings } = await this.lanes.run(
      this.laneKeys.inventory(),
      'read',
      async () =>
        this.listKnownWorktrees.execute(this.listRegisteredProjects.execute()),
      { callerSignal: context.signal },
    );
    await Promise.all(
      listings.flatMap((listing) =>
        listing.worktrees
          .filter((worktree) => worktree.available)
          .map((worktree) =>
            this.refreshWorktreeReview
              .execute({ worktreeId: worktree.id }, context)
              .catch((error: unknown) =>
                this.logger.failure({
                  kind: 'review-refresh',
                  worktreeId: worktree.id,
                  error,
                }),
              ),
          ),
      ),
    );
  }
}
