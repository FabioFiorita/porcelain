import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import type { WorktreeStatuses } from '@porcelain/kernel/models';
import type { ProjectWorktrees } from '@porcelain/projects/models';
import type {
  ListKnownWorktreesService,
  ListRegisteredProjectsService,
} from '@porcelain/projects/services';
import type { ReadTextFilesService } from '@porcelain/files/services';
import type { ReviewTexts } from '@porcelain/reviews/models';
import type {
  ListReviewedLayerPathsService,
  ReadReviewBadgesService,
} from '@porcelain/reviews/services';
import { inventoryReport } from '@porcelain/projects/rules';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

export class ReadInventoryUseCase {
  private readonly listRegisteredProjects: ListRegisteredProjectsService;
  private readonly listKnownWorktrees: ListKnownWorktreesService;
  private readonly readWorktreeStatuses: ReadReviewBadgesService;
  private readonly listReviewedLayerPaths: ListReviewedLayerPathsService;
  private readonly readTextFiles: ReadTextFilesService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    listRegisteredProjects: ListRegisteredProjectsService,
    listKnownWorktrees: ListKnownWorktreesService,
    readWorktreeStatuses: ReadReviewBadgesService,
    listReviewedLayerPaths: ListReviewedLayerPathsService,
    readTextFiles: ReadTextFilesService,
    readEnvironment: ReadEnvironmentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.listRegisteredProjects = listRegisteredProjects;
    this.listKnownWorktrees = listKnownWorktrees;
    this.readWorktreeStatuses = readWorktreeStatuses;
    this.listReviewedLayerPaths = listReviewedLayerPaths;
    this.readTextFiles = readTextFiles;
    this.readEnvironment = readEnvironment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(context: OperationContext): Promise<ReadInventoryResponse> {
    const { inventory, listings } = await this.lanes.run(
      this.laneKeys.inventory(),
      'read',
      async () => {
        const registered = this.listRegisteredProjects.execute();
        return {
          inventory: registered,
          listings: this.listKnownWorktrees.execute(registered).listings,
        };
      },
      { callerSignal: context.signal },
    );
    const statuses = await this.reviewBadges(listings, context);
    const { environmentId } = this.readEnvironment.execute();
    return inventoryReport(environmentId, inventory, listings, statuses);
  }

  private async reviewBadges(
    listings: readonly ProjectWorktrees[],
    context: OperationContext,
  ): Promise<WorktreeStatuses> {
    const badges = await Promise.all(
      listings.flatMap(({ worktrees }) => {
        const [first] = worktrees;
        return first
          ? [
              this.lanes.run(
                this.laneKeys.reviews(first),
                'read',
                async ({ signal }) => {
                  const worktreeIds = worktrees.map((worktree) => worktree.id);
                  const texts = new Map(
                    await Promise.all(
                      worktreeIds.map(
                        async (worktreeId): Promise<[string, ReviewTexts]> => [
                          worktreeId,
                          (
                            await this.readTextFiles.execute(
                              {
                                worktreeId,
                                paths: this.listReviewedLayerPaths.execute({
                                  worktreeId,
                                }).paths,
                              },
                              signal,
                            )
                          ).texts,
                        ],
                      ),
                    ),
                  );
                  return this.readWorktreeStatuses.execute({
                    worktreeIds,
                    texts,
                  }).statuses;
                },
                { callerSignal: context.signal },
              ),
            ]
          : [];
      }),
    );
    return new Map(badges.flatMap((statuses) => [...statuses]));
  }
}
