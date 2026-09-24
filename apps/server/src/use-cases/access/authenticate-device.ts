import type {
  AuthenticateDeviceInput,
  AuthenticatedDevice,
} from '@porcelain/access/models';
import type { AuthenticateDeviceService } from '@porcelain/access/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class AuthenticateDeviceUseCase {
  private readonly authenticateDevice: AuthenticateDeviceService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    authenticateDevice: AuthenticateDeviceService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.authenticateDevice = authenticateDevice;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: AuthenticateDeviceInput,
    context: OperationContext,
  ): Promise<AuthenticatedDevice | undefined> {
    const result = await this.lanes.run(
      this.laneKeys.access(),
      'write',
      async () => this.authenticateDevice.execute(input),
      { callerSignal: context.signal },
    );
    return result.kind === 'authenticated'
      ? { deviceId: result.deviceId }
      : undefined;
  }
}
