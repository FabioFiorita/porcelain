import type {
  ListKnownWorktreesService,
  ListRegisteredProjectsService,
} from '@porcelain/projects/services';
import type { Logger } from '../../ports/logger.ts';
import { Cause, Effect } from 'effect';
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

  execute(): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      const { listings } = yield* this.lanes.run(
        this.laneKeys.inventory(),
        'read',
        () =>
          Effect.gen({ self: this }, function* () {
            const projects = yield* this.listRegisteredProjects.execute();
            return yield* this.listKnownWorktrees.execute(projects);
          }),
      );
      yield* Effect.forEach(
        listings
          .flatMap((listing) => listing.worktrees)
          .filter((worktree) => worktree.available),
        (worktree) =>
          this.refreshWorktreeReview.execute({ worktreeId: worktree.id }).pipe(
            Effect.catchCause((cause) =>
              Cause.hasInterruptsOnly(cause)
                ? Effect.interrupt
                : Effect.sync(() =>
                    this.logger.failure({
                      kind: 'review-refresh',
                      worktreeId: worktree.id,
                      error: Cause.squash(cause),
                    }),
                  ),
            ),
          ),
        { concurrency: 'unbounded' },
      );
    });
  }
}
