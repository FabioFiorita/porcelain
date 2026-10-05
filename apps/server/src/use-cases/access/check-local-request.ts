import { Effect } from 'effect';
import type {
  CheckLocalRequestInput,
  CheckLocalRequestResult,
} from '@porcelain/access/models';
import type { CheckLocalRequestService } from '@porcelain/access/services';
import type { Lanes } from '../../runtime/lanes.ts';

export class CheckLocalRequestUseCase {
  private readonly checkLocalRequest: CheckLocalRequestService;
  private readonly lanes: Lanes;

  constructor(checkLocalRequest: CheckLocalRequestService, lanes: Lanes) {
    this.checkLocalRequest = checkLocalRequest;
    this.lanes = lanes;
  }

  execute(
    input: CheckLocalRequestInput,
  ): Effect.Effect<CheckLocalRequestResult, never> {
    return Effect.gen({ self: this }, function* () {
      return yield* this.lanes.unqueued(() =>
        Effect.gen({ self: this }, function* () {
          return yield* this.checkLocalRequest.execute(input);
        }),
      );
    });
  }
}
