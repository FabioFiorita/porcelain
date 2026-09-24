import type {
  RenameProjectParams,
  RenameProjectRequest,
  RenameProjectResponse,
} from '@porcelain/contracts/projects';
import type { RenameProjectService } from '@porcelain/projects/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

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

  async execute(
    input: RenameProjectParams & RenameProjectRequest,
    context: OperationContext,
  ): Promise<RenameProjectResponse> {
    const result = await this.lanes.run(
      this.laneKeys.inventory(),
      'write',
      async () => this.renameProject.execute(input),
      { callerSignal: context.signal },
    );
    this.events.inventoryChanged();
    return result;
  }
}
