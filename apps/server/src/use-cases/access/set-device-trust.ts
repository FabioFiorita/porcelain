import type { SetDeviceTrustService } from '@porcelain/access/services';
import type {
  SetDeviceTrustRequest,
  SetDeviceTrustResponse,
} from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

export class SetDeviceTrustUseCase {
  private readonly setDeviceTrust: SetDeviceTrustService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    setDeviceTrust: SetDeviceTrustService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.setDeviceTrust = setDeviceTrust;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: SetDeviceTrustRequest,
    context: OperationContext,
  ): Promise<SetDeviceTrustResponse> {
    return this.lanes.run(
      this.laneKeys.access(),
      'write',
      async () => this.setDeviceTrust.execute(input),
      { callerSignal: context.signal },
    );
  }
}
