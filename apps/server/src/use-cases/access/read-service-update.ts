import type { ReadServiceUpdateResponse } from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { ServiceUpdateRunner } from '../../ports/service-update-runner.ts';

export class ReadServiceUpdateUseCase {
  private readonly updates: ServiceUpdateRunner;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(updates: ServiceUpdateRunner, lanes: Lanes, laneKeys: LaneKeys) {
    this.updates = updates;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(context: OperationContext): Promise<ReadServiceUpdateResponse> {
    return this.lanes.run(
      this.laneKeys.serviceUpdate(),
      'read',
      async () => this.updates.read(),
      { callerSignal: context.signal },
    );
  }
}
