import type {
  IdentifyRequestClientInput,
  RequestClient,
} from '@porcelain/access/models';
import type { OperationContext } from './operation-context.ts';

export type IdentifiedClient = RequestClient;

export interface IdentifyRequestClientUseCasePort {
  execute(
    input: IdentifyRequestClientInput,
    context: OperationContext,
  ): Promise<IdentifiedClient>;
}
