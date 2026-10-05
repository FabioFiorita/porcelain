import { Effect } from 'effect';
import type { TooManyPairingAttemptsError } from '@porcelain/access/errors';
import type { TakePairingAttemptInput } from '@porcelain/access/models';
import type { TakePairingAttemptService } from '@porcelain/access/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class TakePairingAttemptUseCase {
  private readonly takePairingAttempt: TakePairingAttemptService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    takePairingAttempt: TakePairingAttemptService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.takePairingAttempt = takePairingAttempt;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: TakePairingAttemptInput,
  ): Effect.Effect<void, TooManyPairingAttemptsError> {
    return Effect.gen({ self: this }, function* () {
      return yield* this.lanes.run(this.laneKeys.access(), 'write', () =>
        Effect.gen({ self: this }, function* () {
          return yield* this.takePairingAttempt.execute(input);
        }),
      );
    });
  }
}
