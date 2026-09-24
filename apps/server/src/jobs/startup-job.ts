import type { Logger } from '../ports/logger.ts';
import type { RecoverInterruptedGitActionsUseCase } from '../use-cases/git-actions/recover-interrupted-git-actions.ts';
import type { RefreshInventoryUseCase } from '../use-cases/projects/refresh-inventory.ts';
import type { Job } from './job.ts';

export class StartupJob implements Job {
  private readonly recoverInterruptedGitActions: Pick<
    RecoverInterruptedGitActionsUseCase,
    'execute'
  >;
  private readonly refreshInventory: Pick<RefreshInventoryUseCase, 'execute'>;
  private readonly logger: Logger;
  private readonly stopped = new AbortController();

  constructor(
    recoverInterruptedGitActions: Pick<
      RecoverInterruptedGitActionsUseCase,
      'execute'
    >,
    refreshInventory: Pick<RefreshInventoryUseCase, 'execute'>,
    logger: Logger,
  ) {
    this.recoverInterruptedGitActions = recoverInterruptedGitActions;
    this.refreshInventory = refreshInventory;
    this.logger = logger;
  }

  start(): void {
    this.recoverInterruptedGitActions
      .execute()
      .catch((error: unknown) => this.reportFailure(error));
    this.refreshInventory
      .execute({ signal: this.stopped.signal })
      .catch((error: unknown) => this.reportFailure(error));
  }

  stop(): void {
    this.stopped.abort();
  }

  private reportFailure(error: unknown): void {
    if (!this.stopped.signal.aborted)
      this.logger.failure({ kind: 'job', job: 'startup', error });
  }
}
