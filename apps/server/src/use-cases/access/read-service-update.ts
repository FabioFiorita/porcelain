import type {
  AuthorizeServiceUpdateService,
  PlanServiceUpdateCheckService,
} from '@porcelain/access/services';
import type {
  ReadServiceUpdateRequest,
  ReadServiceUpdateResponse,
} from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { ServiceUpdateRunner } from '../../ports/service-update-runner.ts';

export class ReadServiceUpdateUseCase {
  private readonly updates: ServiceUpdateRunner;
  private readonly authorizeServiceUpdate: AuthorizeServiceUpdateService;
  private readonly planCheck: PlanServiceUpdateCheckService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    updates: ServiceUpdateRunner,
    authorizeServiceUpdate: AuthorizeServiceUpdateService,
    planCheck: PlanServiceUpdateCheckService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.updates = updates;
    this.authorizeServiceUpdate = authorizeServiceUpdate;
    this.planCheck = planCheck;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: ReadServiceUpdateRequest,
    context: OperationContext,
  ): Promise<ReadServiceUpdateResponse> {
    const check = this.planCheck.execute();
    const authority = await this.lanes.run(
      this.laneKeys.access(),
      'read',
      async () => this.authorizeServiceUpdate.execute(input),
      { callerSignal: context.signal },
    );
    return this.lanes.run(
      this.laneKeys.serviceUpdate(),
      'read',
      async ({ signal }) => ({
        ...(await this.updates.read(check, signal)),
        ...authority,
      }),
      { callerSignal: context.signal },
    );
  }
}
