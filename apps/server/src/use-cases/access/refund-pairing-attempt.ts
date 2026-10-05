import type { Context } from 'effect';
import { Effect } from 'effect';
import type { RefundPairingAttemptInput } from '@porcelain/access/models';
import type { RefundPairingAttemptService } from '@porcelain/access/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class RefundPairingAttemptUseCase {
  private readonly refundPairingAttempt: Context.Service.Shape<
    typeof RefundPairingAttemptService
  >;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    refundPairingAttempt: Context.Service.Shape<
      typeof RefundPairingAttemptService
    >,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.refundPairingAttempt = refundPairingAttempt;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(input: RefundPairingAttemptInput): Effect.Effect<void, never> {
    return Effect.gen({ self: this }, function* () {
      return yield* this.lanes.run(this.laneKeys.access(), 'write', () =>
        Effect.gen({ self: this }, function* () {
          return yield* this.refundPairingAttempt.execute(input);
        }),
      );
    });
  }
}
