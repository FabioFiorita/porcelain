import type {
  CheckLocalRequestInput,
  CheckLocalRequestResult,
} from '@porcelain/access/models';
import type { Effect } from 'effect';

export interface CheckLocalRequestUseCasePort {
  execute(
    input: CheckLocalRequestInput,
  ): Effect.Effect<CheckLocalRequestResult>;
}
