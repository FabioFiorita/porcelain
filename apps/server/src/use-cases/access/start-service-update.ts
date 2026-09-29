import type {
  CheckServiceUpdateService,
  PlanServiceUpdateCheckService,
} from '@porcelain/access/services';
import type {
  StartServiceUpdateRequest,
  StartServiceUpdateResponse,
} from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { ServiceUpdateRunner } from '../../ports/service-update-runner.ts';

export class StartServiceUpdateUseCase {
  private readonly updates: ServiceUpdateRunner;
  private readonly checkServiceUpdate: CheckServiceUpdateService;
  private readonly planCheck: PlanServiceUpdateCheckService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    updates: ServiceUpdateRunner,
    checkServiceUpdate: CheckServiceUpdateService,
    planCheck: PlanServiceUpdateCheckService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.updates = updates;
    this.checkServiceUpdate = checkServiceUpdate;
    this.planCheck = planCheck;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: StartServiceUpdateRequest,
    context: OperationContext,
  ): Promise<StartServiceUpdateResponse> {
    const check = this.planCheck.execute();
    return this.lanes.run(
      this.laneKeys.serviceUpdate(),
      'write',
      async ({ signal }) => {
        this.checkServiceUpdate.execute({
          state: await this.updates.read(check, signal),
          target: input,
        });
        await this.updates.start(input, signal);
        return this.updates.read(check);
      },
      { callerSignal: context.signal },
    );
  }
}
