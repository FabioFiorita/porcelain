import type { TakePairingAttemptInput } from '@porcelain/access/models';
import type { OperationContext } from './operation-context.ts';

export interface TakePairingAttemptUseCasePort {
  execute(
    input: TakePairingAttemptInput,
    context: OperationContext,
  ): Promise<void>;
}
