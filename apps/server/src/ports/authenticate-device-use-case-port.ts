import type {
  AuthenticateDeviceInput,
  AuthenticatedDevice,
} from '@porcelain/access/models';
import type { Effect } from 'effect';

export interface AuthenticateDeviceUseCasePort {
  execute(
    input: AuthenticateDeviceInput,
  ): Effect.Effect<AuthenticatedDevice | undefined>;
}
