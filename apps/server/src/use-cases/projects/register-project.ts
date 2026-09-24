import type {
  RegisterProjectRequest,
  RegisterProjectResponse,
} from '@porcelain/contracts/projects';
import type {
  InspectProjectRepositoryService,
  ListKnownWorktreesService,
  ListRegisteredProjectsService,
  ReadRepositoryOriginService,
  RegisterProjectService,
} from '@porcelain/projects/services';
import type { ReadReviewBadgesService } from '@porcelain/reviews/services';
import { registeredProjectReport } from '@porcelain/projects/rules';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { JobWork } from '../../runtime/interval-job.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class RegisterProjectUseCase {
  private readonly inspectProjectRepository: InspectProjectRepositoryService;
  private readonly readRepositoryOrigin: ReadRepositoryOriginService;
  private readonly registerProject: RegisterProjectService;
  private readonly refreshInventory: JobWork;
  private readonly listRegisteredProjects: ListRegisteredProjectsService;
  private readonly listKnownWorktrees: ListKnownWorktreesService;
  private readonly readWorktreeStatuses: ReadReviewBadgesService;
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
    const report = await this.lanes.run(
      this.laneKeys.inventory(),
      'read',
      async () => {
        const { listings } = this.listKnownWorktrees.execute(
          this.listRegisteredProjects.execute(),
        );
        const { statuses } = this.readWorktreeStatuses.execute({
          worktreeIds: listings.flatMap((listing) =>
            listing.worktrees.map((worktree) => worktree.id),
          ),
        });
        return registeredProjectReport(registered.project, listings, statuses);
      },
      { callerSignal: context.signal },
    );
    if (registered.changed) this.events.inventoryChanged();
    return report;
  }
}
