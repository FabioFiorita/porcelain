import { Effect } from 'effect';
import type { DeviceNotFoundError } from '@porcelain/access/errors';
import type { SetDeviceTrustService } from '@porcelain/access/services';
import type {
  SetDeviceTrustRequest,
  SetDeviceTrustResponse,
} from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

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
  ): Effect.Effect<SetDeviceTrustResponse, DeviceNotFoundError> {
    return Effect.gen({ self: this }, function* () {
      return yield* this.lanes.run(this.laneKeys.access(), 'write', () =>
        Effect.gen({ self: this }, function* () {
          return yield* this.setDeviceTrust.execute(input);
        }),
      );
    });
  }
}
