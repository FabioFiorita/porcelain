import { Effect } from 'effect';
import type {
  AuthenticatedDevice,
  RedeemLiveTicketInput,
} from '@porcelain/access/models';
import type { RedeemLiveTicketService } from '@porcelain/access/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class RedeemLiveTicketUseCase {
  private readonly redeemLiveTicket: RedeemLiveTicketService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    redeemLiveTicket: RedeemLiveTicketService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.redeemLiveTicket = redeemLiveTicket;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: RedeemLiveTicketInput,
  ): Effect.Effect<AuthenticatedDevice | undefined, never> {
    return Effect.gen({ self: this }, function* () {
      const result = yield* this.lanes.run(
        this.laneKeys.access(),
        'write',
        () =>
          Effect.gen({ self: this }, function* () {
            return yield* this.redeemLiveTicket.execute(input);
          }),
      );
      return result.kind === 'authenticated'
        ? { deviceId: result.deviceId }
        : undefined;
    });
  }
}
