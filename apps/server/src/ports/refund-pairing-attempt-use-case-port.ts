import type { RefundPairingAttemptInput } from '@porcelain/access/models';
import type { OperationContext } from './operation-context.ts';

export interface RefundPairingAttemptUseCasePort {
  execute(
    input: RefundPairingAttemptInput,
    context: OperationContext,
  ): Promise<void>;
}
