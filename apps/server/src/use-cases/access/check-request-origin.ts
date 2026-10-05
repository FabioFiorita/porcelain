import { Effect } from 'effect';
import type { CheckRequestOriginInput } from '@porcelain/access/models';
import type { CheckRequestOriginService } from '@porcelain/access/services';
import type { Lanes } from '../../runtime/lanes.ts';
import type { RequestOriginVerdict } from '../../ports/check-request-origin-use-case-port.ts';

export class CheckRequestOriginUseCase {
  private readonly checkRequestOrigin: CheckRequestOriginService;
  private readonly lanes: Lanes;

  constructor(checkRequestOrigin: CheckRequestOriginService, lanes: Lanes) {
    this.checkRequestOrigin = checkRequestOrigin;
    this.lanes = lanes;
  }

  execute(
    input: CheckRequestOriginInput,
  ): Effect.Effect<RequestOriginVerdict, never> {
    return Effect.gen({ self: this }, function* () {
      return yield* this.lanes.unqueued(() =>
        Effect.gen({ self: this }, function* () {
          const result = yield* this.checkRequestOrigin.execute(input);
          return result.kind === 'allowed'
            ? { allowed: true as const, crossOrigin: result.crossOrigin }
            : { allowed: false as const, refusal: result.refusal };
        }),
      );
    });
  }
}
