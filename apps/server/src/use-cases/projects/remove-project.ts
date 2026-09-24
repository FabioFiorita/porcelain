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
import type { JobWork } from '../../runtime/interval-job.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

export class RemoveProjectUseCase {
  private readonly findProject: FindProjectService;
  private readonly forgetProjectRecords: ForgetProjectRecordsService;
  private readonly removeProject: RemoveProjectService;
  private readonly refreshInventory: JobWork;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    findProject: FindProjectService,
    forgetProjectRecords: ForgetProjectRecordsService,
    removeProject: RemoveProjectService,
    refreshInventory: JobWork,
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

  async execute(
    input: RemoveProjectParams,
    context: OperationContext,
  ): Promise<RemoveProjectResponse> {
    const found = this.findProject.execute({ projectId: input.projectId });
    if (found.kind === 'missing') return { deleted: false };
    await this.lanes.run(
      this.laneKeys.project(found.project),
      'write',
      async () => this.forgetProjectRecords.execute(input),
      { callerSignal: context.signal },
    );
    const result = await this.lanes.run(
      this.laneKeys.inventory(),
      'write',
      async () => this.removeProject.execute(input),
      { callerSignal: context.signal },
    );
    if (result.deleted) await this.refreshInventory.execute(context);
    if (result.deleted) this.events.inventoryChanged();
    return result;
  }
}
