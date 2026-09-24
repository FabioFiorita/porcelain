import type {
  ExpireGitActionReceiptsService,
  RecoverInterruptedGitActionsService,
} from '@porcelain/git-actions/services';
import type { ListRecordedWorktreesService } from '@porcelain/projects/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class RecoverInterruptedGitActionsUseCase {
  private readonly listRecordedWorktrees: ListRecordedWorktreesService;
  private readonly recoverInterruptedGitActions: RecoverInterruptedGitActionsService;
  private readonly expireGitActionReceipts: ExpireGitActionReceiptsService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    listRecordedWorktrees: ListRecordedWorktreesService,
    recoverInterruptedGitActions: RecoverInterruptedGitActionsService,
    expireGitActionReceipts: ExpireGitActionReceiptsService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.listRecordedWorktrees = listRecordedWorktrees;
    this.recoverInterruptedGitActions = recoverInterruptedGitActions;
    this.expireGitActionReceipts = expireGitActionReceipts;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(context: OperationContext): Promise<void> {
    const { worktrees } = await this.lanes.run(
      this.laneKeys.inventory(),
      'read',
      async () => this.listRecordedWorktrees.execute(),
      { callerSignal: context.signal },
    );
    for (const worktree of worktrees)
      await this.lanes.run(
        this.laneKeys.receipts(worktree),
        'write',
        async () => {
          this.recoverInterruptedGitActions.execute({
            worktreeId: worktree.id,
          });
          this.expireGitActionReceipts.execute({ worktreeId: worktree.id });
        },
        { callerSignal: context.signal },
      );
  }
}
