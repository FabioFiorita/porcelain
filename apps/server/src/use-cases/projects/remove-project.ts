import type {
  RemoveProjectParams,
  RemoveProjectResponse,
} from '@porcelain/contracts/projects';
import type {
  ForgetProjectWorktreesService,
  RemoveProjectService,
} from '@porcelain/projects/services';
import type { EventPublisher } from '../../runtime/event-publisher.ts';
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

  execute(
    input: RemoveProjectParams,
    context: OperationContext,
  ): Promise<RemoveProjectResponse> {
    return this.lanes.run(
      this.laneKeys.project(input.projectId),
      'write',
      async () => {
        const result = this.removeProject.execute(input);
        if (!result.deleted) return result;
        this.forgetProjectWorktrees.execute(input);
        this.events.inventoryChanged();
        return result;
      },
      { callerSignal: context.signal },
    );
  }
}
