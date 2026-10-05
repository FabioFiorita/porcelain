import { Effect } from 'effect';
import type {
  RegisterProjectRequest,
  RegisterProjectResponse,
} from '@porcelain/contracts/projects';
import type {
  ProjectNotFoundError,
  RepositoryUnavailableError,
} from '@porcelain/projects/errors';
import type {
  InspectProjectRepositoryService,
  ListKnownWorktreesService,
  ListRegisteredProjectsService,
  ReadRepositoryOriginService,
  RegisterProjectService,
} from '@porcelain/projects/services';
import { registeredProjectReport } from '@porcelain/projects/rules';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { JobRunner } from '../../ports/job-runner.ts';
import type { ReadInventoryBadgesUseCasePort } from '../../ports/read-inventory-badges-use-case-port.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class RegisterProjectUseCase {
  private readonly inspectProjectRepository: InspectProjectRepositoryService;
  private readonly readRepositoryOrigin: ReadRepositoryOriginService;
  private readonly registerProject: RegisterProjectService;
  private readonly refreshInventory: JobRunner<ProjectNotFoundError>;
  private readonly listRegisteredProjects: ListRegisteredProjectsService;
  private readonly listKnownWorktrees: ListKnownWorktreesService;
  private readonly readBadges: ReadInventoryBadgesUseCasePort;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    inspectProjectRepository: InspectProjectRepositoryService,
    readRepositoryOrigin: ReadRepositoryOriginService,
    registerProject: RegisterProjectService,
    refreshInventory: JobRunner<ProjectNotFoundError>,
    listRegisteredProjects: ListRegisteredProjectsService,
    listKnownWorktrees: ListKnownWorktreesService,
    readBadges: ReadInventoryBadgesUseCasePort,
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
    this.readBadges = readBadges;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  execute(
    input: RegisterProjectRequest,
  ): Effect.Effect<
    RegisterProjectResponse,
    RepositoryUnavailableError | ProjectNotFoundError
  > {
    return Effect.gen({ self: this }, function* () {
      const registered = yield* this.lanes.run(
        this.laneKeys.inventory(),
        'write',
        () =>
          Effect.gen({ self: this }, function* () {
            const repository =
              yield* this.inspectProjectRepository.execute(input);
            const { originUrl } =
              yield* this.readRepositoryOrigin.execute(input);
            return yield* this.registerProject.execute({
              repository,
              originUrl,
            });
          }),
      );
      yield* this.refreshInventory.execute();
      const { listings } = yield* this.lanes.run(
        this.laneKeys.inventory(),
        'read',
        () =>
          Effect.flatMap(this.listRegisteredProjects.execute(), (inventory) =>
            this.listKnownWorktrees.execute(inventory),
          ),
      );
      const statuses = yield* this.readBadges.execute({ listings });
      if (registered.changed) this.events.inventoryChanged();
      return registeredProjectReport(registered.project, listings, statuses);
    });
  }
}
