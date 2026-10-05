import { Effect } from 'effect';
import type {
  ExpireGitActionReceiptsService,
  RecoverInterruptedGitActionsService,
} from '@porcelain/git-actions/services';
import type { ListRecordedWorktreesService } from '@porcelain/projects/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

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

  execute(): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      const { worktrees } = yield* this.lanes.run(
        this.laneKeys.inventory(),
        'read',
        () => this.listRecordedWorktrees.execute(),
      );
      for (const worktree of worktrees)
        yield* this.lanes.run(this.laneKeys.receipts(worktree), 'write', () =>
          Effect.gen({ self: this }, function* () {
            yield* this.recoverInterruptedGitActions.execute({
              worktreeId: worktree.id,
            });
            yield* this.expireGitActionReceipts.execute({
              worktreeId: worktree.id,
            });
          }),
        );
    });
  }
}
