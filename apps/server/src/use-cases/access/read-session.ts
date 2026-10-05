import { Effect } from 'effect';
import type {
  ReadSessionRequest,
  ReadSessionResponse,
} from '@porcelain/contracts/access';
import type { Lanes } from '../../runtime/lanes.ts';

export class ReadSessionUseCase {
  private readonly lanes: Lanes;

  constructor(lanes: Lanes) {
    this.lanes = lanes;
  }

  execute(
    input: ReadSessionRequest,
  ): Effect.Effect<ReadSessionResponse, never> {
    return Effect.gen({ self: this }, function* () {
      return yield* this.lanes.unqueued(() =>
        Effect.sync(() => {
          return input.viewer;
        }),
      );
    });
  }
}
