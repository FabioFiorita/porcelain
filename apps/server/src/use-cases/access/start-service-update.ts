import type {
  AuthorizeServiceUpdateService,
  CheckServiceUpdateService,
  PlanServiceUpdateCheckService,
} from '@porcelain/access/services';
import type {
  StartServiceUpdateInput,
  StartServiceUpdateResponse,
} from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { ServiceUpdateRunner } from '../../ports/service-update-runner.ts';

export class StartServiceUpdateUseCase {
  private readonly updates: ServiceUpdateRunner;
  private readonly authorizeServiceUpdate: AuthorizeServiceUpdateService;
  private readonly checkServiceUpdate: CheckServiceUpdateService;
  private readonly planCheck: PlanServiceUpdateCheckService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    updates: ServiceUpdateRunner,
    authorizeServiceUpdate: AuthorizeServiceUpdateService,
    checkServiceUpdate: CheckServiceUpdateService,
    planCheck: PlanServiceUpdateCheckService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.updates = updates;
    this.authorizeServiceUpdate = authorizeServiceUpdate;
    this.checkServiceUpdate = checkServiceUpdate;
    this.planCheck = planCheck;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: StartServiceUpdateInput,
    context: OperationContext,
  ): Promise<StartServiceUpdateResponse> {
    const check = this.planCheck.execute();
    const target = { version: input.version };
    return this.lanes.run(
      this.laneKeys.serviceUpdate(),
      'write',
      async ({ signal }) => {
        const authority = this.authorizeServiceUpdate.execute({
          viewer: input.viewer,
          local: input.local,
        });
        this.checkServiceUpdate.execute({
          authority,
          state: await this.updates.read(check, signal),
          target,
        });
        await this.updates.start(target, signal);
        return { ...(await this.updates.read(check)), ...authority };
      },
      { callerSignal: context.signal },
    );
  }
}
