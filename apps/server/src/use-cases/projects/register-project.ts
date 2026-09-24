import type {
  RegisterProjectRequest,
  RegisterProjectResponse,
} from '@porcelain/contracts/projects';
import type {
  InspectProjectRepositoryService,
  ListOtherProjectsService,
  ListProjectWorktreesService,
  ReadRepositoryOriginService,
  RecordWorktreePresenceService,
  RegisterProjectService,
  UpdateProjectAvailabilityService,
} from '@porcelain/projects/services';
import type { ReadReviewBadgesService } from '@porcelain/reviews/services';
import { projectReport } from '@porcelain/projects/rules';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class RegisterProjectUseCase {
  private readonly inspectProjectRepository: InspectProjectRepositoryService;
  private readonly listOtherProjects: ListOtherProjectsService;
  private readonly listProjectWorktrees: ListProjectWorktreesService;
  private readonly readRepositoryOrigin: ReadRepositoryOriginService;
  private readonly registerProject: RegisterProjectService;
  private readonly updateProjectAvailability: UpdateProjectAvailabilityService;
  private readonly recordWorktreePresence: RecordWorktreePresenceService;
  private readonly readWorktreeStatuses: ReadReviewBadgesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    inspectProjectRepository: InspectProjectRepositoryService,
    listOtherProjects: ListOtherProjectsService,
    listProjectWorktrees: ListProjectWorktreesService,
    readRepositoryOrigin: ReadRepositoryOriginService,
    registerProject: RegisterProjectService,
    updateProjectAvailability: UpdateProjectAvailabilityService,
    recordWorktreePresence: RecordWorktreePresenceService,
    readWorktreeStatuses: ReadReviewBadgesService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.inspectProjectRepository = inspectProjectRepository;
    this.listOtherProjects = listOtherProjects;
    this.listProjectWorktrees = listProjectWorktrees;
    this.readRepositoryOrigin = readRepositoryOrigin;
    this.registerProject = registerProject;
    this.updateProjectAvailability = updateProjectAvailability;
    this.recordWorktreePresence = recordWorktreePresence;
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
        const others = this.listOtherProjects.execute(repository);
        await Promise.all(
          others.projects.map((project) =>
            this.listProjectWorktrees.execute({ project }, signal),
          ),
        );
        const { originUrl } = await this.readRepositoryOrigin.execute(
          input,
          signal,
        );
        const { project, changed } = this.registerProject.execute({
          repository,
          originUrl,
        });
        const worktrees = await this.listProjectWorktrees.execute(
          { project },
          signal,
        );
        this.updateProjectAvailability.execute({ worktrees });
        this.recordWorktreePresence.execute({ worktrees });
        const { statuses } = this.readWorktreeStatuses.execute({
          worktreeIds: worktrees.worktrees.map((worktree) => worktree.id),
        });
        return { report: projectReport(project, worktrees, statuses), changed };
      },
      { callerSignal: context.signal },
    );
    if (registered.changed) this.events.inventoryChanged();
    return registered.report;
  }
}
