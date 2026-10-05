import { Effect } from 'effect';
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

  execute(
    input: AuthenticateDeviceInput,
  ): Effect.Effect<AuthenticatedDevice | undefined, never> {
    return Effect.gen({ self: this }, function* () {
      const desktop = yield* this.authenticateDesktopSession.execute(input);
      if (desktop.kind === 'authenticated')
        return { deviceId: desktop.deviceId };
      const result = yield* this.lanes.run(
        this.laneKeys.access(),
        'write',
        () =>
          Effect.gen({ self: this }, function* () {
            return yield* this.authenticateDevice.execute(input);
          }),
      );
      return result.kind === 'authenticated'
        ? { deviceId: result.deviceId }
        : undefined;
    });
  }
}
