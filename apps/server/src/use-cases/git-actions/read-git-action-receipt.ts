import type {
  ReadGitActionReceiptParams,
  ReadGitActionReceiptResponse,
} from '@porcelain/contracts/git-actions';
import type { ReadGitActionReceiptService } from '@porcelain/git-actions/services';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ReadGitActionReceiptUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly readGitActionReceipt: ReadGitActionReceiptService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeService,
    readGitActionReceipt: ReadGitActionReceiptService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.readGitActionReceipt = readGitActionReceipt;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: ReadGitActionReceiptParams,
    context: OperationContext,
  ): Promise<ReadGitActionReceiptResponse> {
    const worktree = await this.checkWorktree.execute(
      { worktreeId: input.worktreeId, purpose: 'reading' },
      context.signal,
    );
    return this.lanes.run(
      this.laneKeys.receipts(worktree),
      'read',
      async () =>
        this.readGitActionReceipt.execute({
          worktreeId: worktree.id,
          requestId: input.requestId,
        }),
      { callerSignal: context.signal },
    );
  }
}
