import type { Context } from 'effect';
import { Effect } from 'effect';
import type {
  InvalidPairingError,
  InvalidDeviceDetailsError,
} from '@porcelain/access/errors';
import type { RedeemPairingService } from '@porcelain/access/services';
import type {
  RedeemPairingInput,
  RedeemPairingResponse,
} from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class RedeemPairingUseCase {
  private readonly redeemPairing: Context.Service.Shape<
    typeof RedeemPairingService
  >;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    redeemPairing: Context.Service.Shape<typeof RedeemPairingService>,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.redeemPairing = redeemPairing;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: RedeemPairingInput,
  ): Effect.Effect<
    RedeemPairingResponse,
    InvalidPairingError | InvalidDeviceDetailsError
  > {
    return Effect.gen({ self: this }, function* () {
      return yield* this.lanes.run(this.laneKeys.access(), 'write', () =>
        Effect.gen({ self: this }, function* () {
          return yield* this.redeemPairing.execute(input);
        }),
      );
    });
  }
}
