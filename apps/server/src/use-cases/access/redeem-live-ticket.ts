import type {
  AuthenticatedDevice,
  RedeemLiveTicketInput,
} from '@porcelain/access/models';
import type { RedeemLiveTicketService } from '@porcelain/access/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

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

  async execute(
    input: RedeemLiveTicketInput,
    context: OperationContext,
  ): Promise<AuthenticatedDevice | undefined> {
    const result = await this.lanes.run(
      this.laneKeys.access(),
      'write',
      async () => this.redeemLiveTicket.execute(input),
      { callerSignal: context.signal },
    );
    return result.kind === 'authenticated'
      ? { deviceId: result.deviceId }
      : undefined;
  }
}
