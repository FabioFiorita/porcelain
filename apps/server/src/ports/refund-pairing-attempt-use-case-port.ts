import type { RefundPairingAttemptInput } from '@porcelain/access/models';
import type { Effect } from 'effect';

export interface RefundPairingAttemptUseCasePort {
  execute(input: RefundPairingAttemptInput): Effect.Effect<void>;
}
