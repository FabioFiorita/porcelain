import type {
  ReadGitActionReceiptParams,
  ReadGitActionReceiptResponse,
} from '@porcelain/contracts/git-actions';
import type { ReadGitActionReceiptService } from '@porcelain/git-actions/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ReadGitActionReceiptUseCase {
  private readonly readGitActionReceipt: ReadGitActionReceiptService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    readGitActionReceipt: ReadGitActionReceiptService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.readGitActionReceipt = readGitActionReceipt;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: ReadGitActionReceiptParams,
    context: OperationContext,
  ): Promise<ReadGitActionReceiptResponse> {
    return this.lanes.run(
      this.laneKeys.inventory(),
      'read',
      async () =>
        this.readGitActionReceipt.execute({
          worktreeId: input.worktreeId,
          requestId: input.requestId,
        }),
      { callerSignal: context.signal },
    );
  }
}
