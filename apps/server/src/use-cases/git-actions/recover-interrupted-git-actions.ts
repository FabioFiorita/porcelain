import type {
  ExpireGitActionReceiptsService,
  RecoverInterruptedGitActionsService,
} from '@porcelain/git-actions/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class RecoverInterruptedGitActionsUseCase {
  private readonly recoverInterruptedGitActions: RecoverInterruptedGitActionsService;
  private readonly expireGitActionReceipts: ExpireGitActionReceiptsService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    recoverInterruptedGitActions: RecoverInterruptedGitActionsService,
    expireGitActionReceipts: ExpireGitActionReceiptsService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.recoverInterruptedGitActions = recoverInterruptedGitActions;
    this.expireGitActionReceipts = expireGitActionReceipts;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(context: OperationContext): Promise<void> {
    return this.lanes.run(
      this.laneKeys.inventory(),
      'write',
      async () => {
        this.recoverInterruptedGitActions.execute();
        this.expireGitActionReceipts.execute();
      },
      { callerSignal: context.signal },
    );
  }
}
