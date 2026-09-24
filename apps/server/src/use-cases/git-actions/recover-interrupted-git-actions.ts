import type {
  ExpireGitActionReceiptsService,
  RecoverInterruptedGitActionsService,
} from '@porcelain/git-actions/services';

export class RecoverInterruptedGitActionsUseCase {
  private readonly recoverInterruptedGitActions: RecoverInterruptedGitActionsService;
  private readonly expireGitActionReceipts: ExpireGitActionReceiptsService;

  constructor(
    recoverInterruptedGitActions: RecoverInterruptedGitActionsService,
    expireGitActionReceipts: ExpireGitActionReceiptsService,
  ) {
    this.recoverInterruptedGitActions = recoverInterruptedGitActions;
    this.expireGitActionReceipts = expireGitActionReceipts;
  }

  execute(): void {
    this.recoverInterruptedGitActions.execute();
    this.expireGitActionReceipts.execute();
  }
}
