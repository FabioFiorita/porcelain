import type {
  DismissInterruptedGitActionParams,
  DismissInterruptedGitActionResponse,
} from '@porcelain/contracts/git-actions';
import type {
  DismissInterruptedGitActionService,
  ReadGitActionReceiptService,
} from '@porcelain/git-actions/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class DismissInterruptedGitActionUseCase {
  private readonly dismissInterruptedGitAction: DismissInterruptedGitActionService;
  private readonly readGitActionReceipt: ReadGitActionReceiptService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    dismissInterruptedGitAction: DismissInterruptedGitActionService,
    readGitActionReceipt: ReadGitActionReceiptService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.dismissInterruptedGitAction = dismissInterruptedGitAction;
    this.readGitActionReceipt = readGitActionReceipt;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(
    input: DismissInterruptedGitActionParams,
    context: OperationContext,
  ): Promise<DismissInterruptedGitActionResponse> {
    const receipt = await this.lanes.run(
      this.laneKeys.inventory(),
      'write',
      async () => {
        this.dismissInterruptedGitAction.execute(input);
        return this.readGitActionReceipt.execute({
          requestId: input.requestId,
        });
      },
      { callerSignal: context.signal },
    );
    this.events.gitActionChanged(receipt);
    return { dismissed: true };
  }
}
