import type { WorktreeChange } from '../../ports/announce-worktree-change-use-case-port.ts';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { InvalidateReviewedMarksUseCasePort } from '../../ports/invalidate-reviewed-marks-use-case-port.ts';
import type { Logger } from '../../ports/logger.ts';
import { Cause, Effect } from 'effect';

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

  execute(input: WorktreeChange): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      const { worktreeId } = input;
      const paths =
        input.change === 'files' && input.paths.length > 0
          ? input.paths
          : undefined;
      yield* this.invalidateReviewedMarks.execute({ worktreeId, paths }).pipe(
        Effect.catchCause((cause) =>
          Effect.sync(() =>
            this.logger.failure({
              kind: 'reviewed-marks',
              worktreeId,
              error: Cause.squash(cause),
            }),
          ),
        ),
      );
      if (input.change === 'files')
        this.events.filesChanged({ worktreeId, paths: input.paths });
      else this.events.worktreeChanged({ worktreeId, change: 'git' });
    });
  }
}
