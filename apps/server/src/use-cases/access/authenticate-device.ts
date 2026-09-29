import type {
  AuthenticateDeviceInput,
  AuthenticatedDevice,
} from '@porcelain/access/models';
import type {
  AuthenticateDeviceService,
  AuthenticateDesktopSessionService,
} from '@porcelain/access/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

export class AuthenticateDeviceUseCase {
  private readonly authenticateDevice: AuthenticateDeviceService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly authenticateDesktopSession: AuthenticateDesktopSessionService;

  constructor(
    authenticateDevice: AuthenticateDeviceService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    authenticateDesktopSession: AuthenticateDesktopSessionService,
  ) {
    this.authenticateDevice = authenticateDevice;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.authenticateDesktopSession = authenticateDesktopSession;
  }

  async execute(
    input: AuthenticateDeviceInput,
    context: OperationContext,
  ): Promise<AuthenticatedDevice | undefined> {
    const desktop = this.authenticateDesktopSession.execute(input);
    if (desktop.kind === 'authenticated') return { deviceId: desktop.deviceId };
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
