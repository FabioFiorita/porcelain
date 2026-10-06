import type {
  AuthenticatedDevice,
  RedeemLiveTicketInput,
} from '@porcelain/access/models';
import type { Effect } from 'effect';

export interface RedeemLiveTicketUseCasePort {
  execute(
    input: RedeemLiveTicketInput,
  ): Effect.Effect<AuthenticatedDevice | undefined>;
}
