import type { WorktreeChange } from '../../ports/announce-worktree-change-use-case-port.ts';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { InvalidateReviewedMarksUseCasePort } from '../../ports/invalidate-reviewed-marks-use-case-port.ts';
import type { Logger } from '../../ports/logger.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

export class AnnounceWorktreeChangeUseCase {
  private readonly invalidateReviewedMarks: InvalidateReviewedMarksUseCasePort;
  private readonly events: EventPublisher;
  private readonly logger: Logger;

  constructor(
    invalidateReviewedMarks: InvalidateReviewedMarksUseCasePort,
    events: EventPublisher,
    logger: Logger,
  ) {
    this.invalidateReviewedMarks = invalidateReviewedMarks;
    this.events = events;
    this.logger = logger;
  }

  async execute(
    input: WorktreeChange,
    context: OperationContext,
  ): Promise<void> {
    const { worktreeId } = input;
    const paths =
      input.change === 'files' && input.paths.length > 0
        ? input.paths
        : undefined;
    await this.invalidateReviewedMarks
      .execute({ worktreeId, paths }, context)
      .catch((error: unknown) =>
        this.logger.failure({ kind: 'reviewed-marks', worktreeId, error }),
      );
    if (input.change === 'files')
      this.events.filesChanged({ worktreeId, paths: input.paths });
    else this.events.worktreeChanged({ worktreeId, change: 'git' });
  }
}
