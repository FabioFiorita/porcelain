import type {
  ExpireGitActionReceiptsService,
  RecoverInterruptedGitActionsService,
} from '@porcelain/git-actions/services';
import type { OperationContext } from '../runtime/operation-context.ts';

export class RecoverInterruptedGitActionsController {
  private readonly recoverInterruptedGitActions: RecoverInterruptedGitActionsService;
  private readonly expireGitActionReceipts: ExpireGitActionReceiptsService;

  constructor(
    recoverInterruptedGitActions: RecoverInterruptedGitActionsService,
    expireGitActionReceipts: ExpireGitActionReceiptsService,
  ) {
    this.recoverInterruptedGitActions = recoverInterruptedGitActions;
    this.expireGitActionReceipts = expireGitActionReceipts;
  }

  execute(input: Record<never, never>, context: OperationContext): void {
    context.signal?.throwIfAborted();
    this.recoverInterruptedGitActions.execute(input);
    this.expireGitActionReceipts.execute(input);
  }
}
