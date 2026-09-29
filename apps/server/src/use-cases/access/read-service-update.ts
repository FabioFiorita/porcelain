import type { PlanServiceUpdateCheckService } from '@porcelain/access/services';
import type { ReadServiceUpdateResponse } from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { ServiceUpdateRunner } from '../../ports/service-update-runner.ts';

export class ReadServiceUpdateUseCase {
  private readonly updates: ServiceUpdateRunner;
  private readonly planCheck: PlanServiceUpdateCheckService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    updates: ServiceUpdateRunner,
    planCheck: PlanServiceUpdateCheckService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.updates = updates;
    this.planCheck = planCheck;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(context: OperationContext): Promise<ReadServiceUpdateResponse> {
    const check = this.planCheck.execute();
    return this.lanes.run(
      this.laneKeys.serviceUpdate(),
      'read',
      async ({ signal }) => this.updates.read(check, signal),
      { callerSignal: context.signal },
    );
  }
}
