import type {
  RenameProjectParams,
  RenameProjectRequest,
  RenameProjectResponse,
} from '@porcelain/contracts/projects';
import type { RenameProjectService } from '@porcelain/projects/services';
import type { EventPublisher } from '../runtime/event-publisher.ts';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class RenameProjectController {
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
    context: OperationContext,
  ): Promise<RenameProjectResponse> {
    return this.lanes.run(
      this.laneKeys.inventory(),
      'write',
      async () => {
        const result = this.renameProject.execute(input);
        this.events.inventoryChanged();
        return result;
      },
      { callerSignal: context.signal },
    );
  }
}
