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
import type { OperationContext } from '../../runtime/operation-context.ts';

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
    context: OperationContext,
  ): Promise<RevokeAccessResponse> {
    return this.lanes.run(
      this.laneKeys.access(),
      'write',
      async () => {
        if (this.revokePairingGrant.execute(input).kind === 'revoked')
          return { revoked: true, kind: 'grant' };
        if (this.revokeDevice.execute(input).kind === 'revoked') {
          this.deviceConnections.remove({ deviceId: input.id });
          return { revoked: true, kind: 'device' };
        }
        return { revoked: false };
      },
      { callerSignal: context.signal },
    );
  }
}
