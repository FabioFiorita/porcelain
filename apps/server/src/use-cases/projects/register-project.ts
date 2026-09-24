import type {
  RegisterProjectRequest,
  RegisterProjectResponse,
} from '@porcelain/contracts/projects';
import type {
  ComposeProjectReportService,
  InspectProjectRepositoryService,
  ListOtherProjectsService,
  ListProjectWorktreesService,
  ReadRepositoryOriginService,
  ReadWorktreeStatusesService,
  RegisterProjectService,
} from '@porcelain/projects/services';
import type { EventPublisher } from '../../runtime/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class RegisterProjectUseCase {
  private readonly inspectProjectRepository: InspectProjectRepositoryService;
  private readonly listOtherProjects: ListOtherProjectsService;
  private readonly listProjectWorktrees: ListProjectWorktreesService;
  private readonly readRepositoryOrigin: ReadRepositoryOriginService;
  private readonly registerProject: RegisterProjectService;
  private readonly readWorktreeStatuses: ReadWorktreeStatusesService;
  private readonly composeProjectReport: ComposeProjectReportService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    inspectProjectRepository: InspectProjectRepositoryService,
    listOtherProjects: ListOtherProjectsService,
    listProjectWorktrees: ListProjectWorktreesService,
    readRepositoryOrigin: ReadRepositoryOriginService,
    registerProject: RegisterProjectService,
    readWorktreeStatuses: ReadWorktreeStatusesService,
    composeProjectReport: ComposeProjectReportService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.inspectProjectRepository = inspectProjectRepository;
    this.listOtherProjects = listOtherProjects;
    this.listProjectWorktrees = listProjectWorktrees;
    this.readRepositoryOrigin = readRepositoryOrigin;
    this.registerProject = registerProject;
    this.readWorktreeStatuses = readWorktreeStatuses;
    this.composeProjectReport = composeProjectReport;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  execute(
    input: RegisterProjectRequest,
    context: OperationContext,
  ): Promise<RegisterProjectResponse> {
    return this.lanes.run(
      this.laneKeys.inventory(),
      'write',
      async ({ signal }) => {
        const repository = await this.inspectProjectRepository.execute(
          input,
          signal,
        );
        const others = this.listOtherProjects.execute({
          repositoryIdentity: repository.repositoryIdentity,
        });
        await Promise.all(
          others.map((project) =>
            this.listProjectWorktrees.execute({ project }, signal),
          ),
        );
        const { originUrl } = await this.readRepositoryOrigin.execute(
          input,
          signal,
        );
        const project = this.registerProject.execute({ repository, originUrl });
        const worktrees = await this.listProjectWorktrees.execute(
          { project },
          signal,
        );
        const statuses = this.readWorktreeStatuses.execute({
          listings: [worktrees],
        });
        const report = this.composeProjectReport.execute({
          project,
          worktrees,
          statuses,
        });
        this.events.inventoryChanged();
        return report;
      },
      { callerSignal: context.signal },
    );
  }
}
