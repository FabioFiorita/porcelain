import type {
  RevokeDeviceService,
  RevokePairingGrantService,
} from '@porcelain/access/services';
import type {
  RevokeAccessRequest,
  RevokeAccessResponse,
} from '@porcelain/contracts/access';
import type { DeviceConnections } from '../../ports/device-connections.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

const ACCESS_LANE = 'access';

export class RevokeAccessUseCase {
  private readonly revokePairingGrant: RevokePairingGrantService;
  private readonly revokeDevice: RevokeDeviceService;
  private readonly deviceConnections: DeviceConnections;
  private readonly lanes: Lanes;

  constructor(
    revokePairingGrant: RevokePairingGrantService,
    revokeDevice: RevokeDeviceService,
    deviceConnections: DeviceConnections,
    lanes: Lanes,
  ) {
    this.revokePairingGrant = revokePairingGrant;
    this.revokeDevice = revokeDevice;
    this.deviceConnections = deviceConnections;
    this.lanes = lanes;
  }

  execute(
    input: RevokeAccessRequest,
    context: OperationContext,
  ): Promise<RevokeAccessResponse> {
    return this.lanes.run(
      ACCESS_LANE,
      'write',
      async () => {
        if (this.revokePairingGrant.execute(input).kind === 'revoked')
          return { revoked: true, kind: 'grant' };
        if (this.revokeDevice.execute(input).kind === 'revoked') {
          this.deviceConnections.close({ deviceId: input.id });
          return { revoked: true, kind: 'device' };
        }
        return { revoked: false };
      },
      { callerSignal: context.signal },
    );
  }
}
