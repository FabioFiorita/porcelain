import { Effect } from 'effect';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import type {
  RemoveProjectParams,
  RemoveProjectResponse,
} from '@porcelain/contracts/projects';
import type {
  FindProjectService,
  ForgetProjectRecordsService,
  RemoveProjectService,
} from '@porcelain/projects/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { JobRunner } from '../../ports/job-runner.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class RemoveProjectUseCase {
  private readonly findProject: FindProjectService;
  private readonly forgetProjectRecords: ForgetProjectRecordsService;
  private readonly removeProject: RemoveProjectService;
  private readonly refreshInventory: JobRunner<ProjectNotFoundError>;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    findProject: FindProjectService,
    forgetProjectRecords: ForgetProjectRecordsService,
    removeProject: RemoveProjectService,
    refreshInventory: JobRunner<ProjectNotFoundError>,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.findProject = findProject;
    this.forgetProjectRecords = forgetProjectRecords;
    this.removeProject = removeProject;
    this.refreshInventory = refreshInventory;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  execute(
    input: RemoveProjectParams,
  ): Effect.Effect<RemoveProjectResponse, ProjectNotFoundError> {
    return Effect.gen({ self: this }, function* () {
      const found = yield* this.findProject.execute({
        projectId: input.projectId,
      });
      if (found.kind === 'missing') return { deleted: false };
      yield* this.lanes.run(this.laneKeys.project(found.project), 'write', () =>
        this.forgetProjectRecords.execute(input),
      );
      const result = yield* this.lanes.run(
        this.laneKeys.inventory(),
        'write',
        () => this.removeProject.execute(input),
      );
      if (result.deleted) {
        yield* this.refreshInventory.execute();
        this.events.inventoryChanged();
      }
      return result;
    });
  }
}
