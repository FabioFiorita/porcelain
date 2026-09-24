import type {
  AuthenticateDeviceInput,
  AuthenticateDeviceResult,
} from '@porcelain/access/models';
import type { AuthenticateDeviceService } from '@porcelain/access/services';

export class AuthenticateDeviceUseCase {
  private readonly authenticateDeviceService: AuthenticateDeviceService;

  constructor(authenticateDeviceService: AuthenticateDeviceService) {
    this.authenticateDeviceService = authenticateDeviceService;
  }

  execute(input: AuthenticateDeviceInput): AuthenticateDeviceResult {
    return this.authenticateDeviceService.execute(input);
  }
}
