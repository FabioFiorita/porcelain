import type { Effect } from 'effect';
import type { WaysInCaller } from '@porcelain/access/models';

export interface AuthorizeSharingUseCasePort {
  execute(input: WaysInCaller): Effect.Effect<boolean>;
}
