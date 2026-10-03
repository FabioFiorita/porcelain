import type {
  AuthenticateDeviceInput,
  AuthenticatedDevice,
} from '@porcelain/access/models';
import type { OperationContext } from './operation-context.ts';

export interface AuthenticateDeviceUseCasePort {
  execute(
    input: AuthenticateDeviceInput,
    context: OperationContext,
  ): Promise<AuthenticatedDevice | undefined>;
}
