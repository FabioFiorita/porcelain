import { Effect } from 'effect';
import type {
  CheckLocalRequestInput,
  CheckLocalRequestResult,
} from '../models/check-local-request.ts';
import { localRequest } from '../rules/local-request.ts';

export class CheckLocalRequestService {
  execute(
    input: CheckLocalRequestInput,
  ): Effect.Effect<CheckLocalRequestResult, never> {
    return Effect.sync(() => {
      return localRequest(input) ? { kind: 'local' } : { kind: 'remote' };
    });
  }
}
