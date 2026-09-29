import type { CheckServiceUpdateService } from '@porcelain/access/services';
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
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    updates: ServiceUpdateRunner,
    checkServiceUpdate: CheckServiceUpdateService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.updates = updates;
    this.checkServiceUpdate = checkServiceUpdate;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: StartServiceUpdateRequest,
    context: OperationContext,
  ): Promise<StartServiceUpdateResponse> {
    return this.lanes.run(
      this.laneKeys.serviceUpdate(),
      'write',
      async () => {
        this.checkServiceUpdate.execute({
          state: await this.updates.read(),
          target: input,
        });
        await this.updates.start(input);
        return this.updates.read();
      },
      { callerSignal: context.signal },
    );
  }
}
