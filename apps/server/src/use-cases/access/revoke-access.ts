import { Effect } from 'effect';
import type {
  RevokeDeviceService,
  RevokePairingGrantService,
} from '@porcelain/access/services';
import type {
  RevokeAccessRequest,
  RevokeAccessResponse,
} from '@porcelain/contracts/access';
import type { DeviceConnectionStore } from '../../ports/device-connection-store.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class RevokeAccessUseCase {
  private readonly revokePairingGrant: RevokePairingGrantService;
  private readonly revokeDevice: RevokeDeviceService;
  private readonly deviceConnections: DeviceConnectionStore;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    revokePairingGrant: RevokePairingGrantService,
    revokeDevice: RevokeDeviceService,
    deviceConnections: DeviceConnectionStore,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.revokePairingGrant = revokePairingGrant;
    this.revokeDevice = revokeDevice;
    this.deviceConnections = deviceConnections;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: RevokeAccessRequest,
  ): Effect.Effect<RevokeAccessResponse, never> {
    return Effect.gen({ self: this }, function* () {
      return yield* this.lanes.run(this.laneKeys.access(), 'write', () =>
        Effect.gen({ self: this }, function* () {
          if (
            (yield* this.revokePairingGrant.execute(input)).kind === 'revoked'
          )
            return { revoked: true, kind: 'grant' as const };
          if ((yield* this.revokeDevice.execute(input)).kind === 'revoked') {
            this.deviceConnections.remove({ deviceId: input.id });
            return { revoked: true, kind: 'device' as const };
          }
          return { revoked: false };
        }),
      );
    });
  }
}
