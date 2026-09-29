import type {
  CheckLocalRequestInput,
  CheckLocalRequestResult,
} from '@porcelain/access/models';
import type { OperationContext } from './operation-context.ts';

export interface CheckLocalRequestUseCasePort {
  execute(
    input: CheckLocalRequestInput,
    context: OperationContext,
  ): Promise<CheckLocalRequestResult>;
}
