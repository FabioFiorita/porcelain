import type {
  AuthenticatedDevice,
  RedeemLiveTicketInput,
} from '@porcelain/access/models';
import type { OperationContext } from './operation-context.ts';

export interface RedeemLiveTicketUseCasePort {
  execute(
    input: RedeemLiveTicketInput,
    context: OperationContext,
  ): Promise<AuthenticatedDevice | undefined>;
}
