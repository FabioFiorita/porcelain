import type {
  AuthenticateDeviceInput,
  AuthenticateDeviceResult,
} from '@porcelain/access/models';
import type { AuthenticateDeviceService } from '@porcelain/access/services';
import type { OperationContext } from '../runtime/operation-context.ts';

export class AuthenticateDeviceController {
  private readonly authenticateDeviceService: AuthenticateDeviceService;

  constructor(authenticateDeviceService: AuthenticateDeviceService) {
    this.authenticateDeviceService = authenticateDeviceService;
  }

  execute(
    input: AuthenticateDeviceInput,
    context: OperationContext,
  ): AuthenticateDeviceResult {
    context.signal?.throwIfAborted();
    return this.authenticateDeviceService.execute(input);
  }
}
