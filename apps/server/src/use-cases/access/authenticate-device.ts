import type {
  AuthenticateDeviceInput,
  AuthenticatedDevice,
} from '@porcelain/access/models';
import type { AuthenticateDeviceService } from '@porcelain/access/services';

export class AuthenticateDeviceUseCase {
  private readonly authenticateDevice: AuthenticateDeviceService;

  constructor(authenticateDevice: AuthenticateDeviceService) {
    this.authenticateDevice = authenticateDevice;
  }

  execute(input: AuthenticateDeviceInput): AuthenticatedDevice | undefined {
    const result = this.authenticateDevice.execute(input);
    return result.kind === 'authenticated'
      ? { deviceId: result.deviceId }
      : undefined;
  }
}
