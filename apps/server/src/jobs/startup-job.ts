import type { EventPublisher } from '../ports/event-publisher.ts';
import type { RecoverInterruptedGitActionsUseCase } from '../use-cases/git-actions/recover-interrupted-git-actions.ts';
import type { RefreshInventoryUseCase } from '../use-cases/projects/refresh-inventory.ts';
import type { Job } from './job.ts';

export class StartupJob implements Job {
  private readonly recoverInterruptedGitActions: Pick<
    RecoverInterruptedGitActionsUseCase,
    'execute'
  >;
  private readonly refreshInventory: Pick<RefreshInventoryUseCase, 'execute'>;
  private readonly events: EventPublisher;
  private readonly stopped = new AbortController();

  constructor(
    recoverInterruptedGitActions: Pick<
      RecoverInterruptedGitActionsUseCase,
      'execute'
    >,
    refreshInventory: Pick<RefreshInventoryUseCase, 'execute'>,
    events: EventPublisher,
  ) {
    this.recoverInterruptedGitActions = recoverInterruptedGitActions;
    this.refreshInventory = refreshInventory;
    this.events = events;
  }

  start(): void {
    this.recoverInterruptedGitActions
      .execute({ signal: this.stopped.signal })
      .catch((error: unknown) => this.reportFailure(error));
    this.refreshInventory
      .execute({ signal: this.stopped.signal })
      .catch((error: unknown) => this.reportFailure(error));
  }

  stop(): void {
    this.stopped.abort();
  }

  private reportFailure(error: unknown): void {
    if (!this.stopped.signal.aborted) this.events.jobFailed('startup', error);
  }
}
