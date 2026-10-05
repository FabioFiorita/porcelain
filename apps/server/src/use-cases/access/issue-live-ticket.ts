import { Effect } from 'effect';
import type {
  DeviceViewerRequiredError,
  TooManyLiveTicketsError,
} from '@porcelain/access/errors';
import type { IssueLiveTicketService } from '@porcelain/access/services';
import type {
  IssueLiveTicketRequest,
  IssueLiveTicketResponse,
} from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class IssueLiveTicketUseCase {
  private readonly issueLiveTicket: IssueLiveTicketService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    issueLiveTicket: IssueLiveTicketService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.issueLiveTicket = issueLiveTicket;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: IssueLiveTicketRequest,
  ): Effect.Effect<
    IssueLiveTicketResponse,
    DeviceViewerRequiredError | TooManyLiveTicketsError
  > {
    return Effect.gen({ self: this }, function* () {
      return yield* this.lanes.run(this.laneKeys.access(), 'write', () =>
        Effect.gen({ self: this }, function* () {
          return yield* this.issueLiveTicket.execute(input);
        }),
      );
    });
  }
}
