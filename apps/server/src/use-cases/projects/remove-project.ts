import type {
  RemoveProjectParams,
  RemoveProjectResponse,
} from '@porcelain/contracts/projects';
import type {
  ForgetProjectWorktreesService,
  RemoveProjectService,
} from '@porcelain/projects/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class RemoveProjectUseCase {
  private readonly removeProject: RemoveProjectService;
  private readonly forgetProjectWorktrees: ForgetProjectWorktreesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    removeProject: RemoveProjectService,
    forgetProjectWorktrees: ForgetProjectWorktreesService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.removeProject = removeProject;
    this.forgetProjectWorktrees = forgetProjectWorktrees;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(
    input: RemoveProjectParams,
    context: OperationContext,
  ): Promise<RemoveProjectResponse> {
    const result = await this.lanes.run(
      this.laneKeys.project(input.projectId),
      'write',
      ({ signal }) =>
        this.lanes.run(
          this.laneKeys.inventory(),
          'write',
          async () => {
            const result = this.removeProject.execute(input);
            if (result.deleted) this.forgetProjectWorktrees.execute(input);
            return result;
          },
          { callerSignal: signal },
        ),
      { callerSignal: context.signal },
    );
    if (result.deleted) this.events.inventoryChanged();
    return result;
  }
}
