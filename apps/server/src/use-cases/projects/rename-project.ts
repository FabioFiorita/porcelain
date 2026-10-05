import { Effect } from 'effect';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import type {
  RenameProjectParams,
  RenameProjectRequest,
  RenameProjectResponse,
} from '@porcelain/contracts/projects';
import type { RenameProjectService } from '@porcelain/projects/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class RenameProjectUseCase {
  private readonly renameProject: RenameProjectService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    renameProject: RenameProjectService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.renameProject = renameProject;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  execute(
    input: RenameProjectParams & RenameProjectRequest,
  ): Effect.Effect<RenameProjectResponse, ProjectNotFoundError> {
    return this.lanes
      .run(this.laneKeys.inventory(), 'write', () =>
        this.renameProject.execute(input),
      )
      .pipe(
        Effect.map((result) => {
          if (result.changed) this.events.inventoryChanged();
          return result.project;
        }),
      );
  }
}
