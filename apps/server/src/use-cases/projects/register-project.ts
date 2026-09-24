import type {
  RegisterProjectRequest,
  RegisterProjectResponse,
} from '@porcelain/contracts/projects';
import type { WorktreeStatuses } from '@porcelain/kernel/models';
import type { ProjectWorktrees } from '@porcelain/projects/models';
import type {
  InspectProjectRepositoryService,
  ListKnownWorktreesService,
  ListRegisteredProjectsService,
  ReadRepositoryOriginService,
  RegisterProjectService,
} from '@porcelain/projects/services';
import type { ReadTextFilesService } from '@porcelain/files/services';
import type { ReviewTexts } from '@porcelain/reviews/models';
import type {
  ListReviewedLayerPathsService,
  ReadReviewBadgesService,
} from '@porcelain/reviews/services';
import { registeredProjectReport } from '@porcelain/projects/rules';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { JobWork } from '../../ports/job-work.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

export class RegisterProjectUseCase {
  private readonly inspectProjectRepository: InspectProjectRepositoryService;
  private readonly readRepositoryOrigin: ReadRepositoryOriginService;
  private readonly registerProject: RegisterProjectService;
  private readonly refreshInventory: JobWork;
  private readonly listRegisteredProjects: ListRegisteredProjectsService;
  private readonly listKnownWorktrees: ListKnownWorktreesService;
  private readonly readWorktreeStatuses: ReadReviewBadgesService;
  private readonly listReviewedLayerPaths: ListReviewedLayerPathsService;
  private readonly readTextFiles: ReadTextFilesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    inspectProjectRepository: InspectProjectRepositoryService,
    readRepositoryOrigin: ReadRepositoryOriginService,
    registerProject: RegisterProjectService,
    refreshInventory: JobWork,
    listRegisteredProjects: ListRegisteredProjectsService,
    listKnownWorktrees: ListKnownWorktreesService,
    readWorktreeStatuses: ReadReviewBadgesService,
    listReviewedLayerPaths: ListReviewedLayerPathsService,
    readTextFiles: ReadTextFilesService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.inspectProjectRepository = inspectProjectRepository;
    this.readRepositoryOrigin = readRepositoryOrigin;
    this.registerProject = registerProject;
    this.refreshInventory = refreshInventory;
    this.listRegisteredProjects = listRegisteredProjects;
    this.listKnownWorktrees = listKnownWorktrees;
    this.readWorktreeStatuses = readWorktreeStatuses;
    this.listReviewedLayerPaths = listReviewedLayerPaths;
    this.readTextFiles = readTextFiles;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(
    input: RegisterProjectRequest,
    context: OperationContext,
  ): Promise<RegisterProjectResponse> {
    const registered = await this.lanes.run(
      this.laneKeys.inventory(),
      'write',
      async ({ signal }) => {
        const repository = await this.inspectProjectRepository.execute(
          input,
          signal,
        );
        const { originUrl } = await this.readRepositoryOrigin.execute(
          input,
          signal,
        );
        return this.registerProject.execute({ repository, originUrl });
      },
      { callerSignal: context.signal },
    );
    await this.refreshInventory.execute(context);
    const { listings } = await this.lanes.run(
      this.laneKeys.inventory(),
      'read',
      async () =>
        this.listKnownWorktrees.execute(this.listRegisteredProjects.execute()),
      { callerSignal: context.signal },
    );
    const statuses = await this.reviewBadges(listings, context);
    if (registered.changed) this.events.inventoryChanged();
    return registeredProjectReport(registered.project, listings, statuses);
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
