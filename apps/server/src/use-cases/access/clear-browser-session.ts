import { Effect } from 'effect';
import type { ClearBrowserSessionResponse } from '@porcelain/contracts/access';
import type { Lanes } from '../../runtime/lanes.ts';

export class ClearBrowserSessionUseCase {
  private readonly lanes: Lanes;

  constructor(lanes: Lanes) {
    this.lanes = lanes;
  }

  execute(): Effect.Effect<ClearBrowserSessionResponse, never> {
    return Effect.gen({ self: this }, function* () {
      return yield* this.lanes.unqueued(() =>
        Effect.sync(() => {
          return undefined;
        }),
      );
    });
  }
}
