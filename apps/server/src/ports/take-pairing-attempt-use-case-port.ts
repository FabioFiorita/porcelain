import type { TooManyPairingAttemptsError } from '@porcelain/access/errors';
import type { TakePairingAttemptInput } from '@porcelain/access/models';
import type { Effect } from 'effect';

export interface TakePairingAttemptUseCasePort {
  execute(
    input: TakePairingAttemptInput,
  ): Effect.Effect<void, TooManyPairingAttemptsError>;
}
