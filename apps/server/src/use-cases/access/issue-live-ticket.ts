import type { IssueLiveTicketService } from '@porcelain/access/services';
import type {
  IssueLiveTicketRequest,
  IssueLiveTicketResponse,
} from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

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
    context: OperationContext,
  ): Promise<IssueLiveTicketResponse> {
    return this.lanes.run(
      this.laneKeys.access(),
      'write',
      async () => this.issueLiveTicket.execute(input),
      { callerSignal: context.signal },
    );
  }
}
