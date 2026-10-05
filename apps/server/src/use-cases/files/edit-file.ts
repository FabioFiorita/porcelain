import type {
  EditFileRequest,
  EditFileResponse,
} from '@porcelain/contracts/files';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  EditFileFailure,
  EditFileService,
} from '@porcelain/files/services';
import { Cause, Effect } from 'effect';
import type { EditAnnouncementWriter } from '../../ports/edit-announcement-writer.ts';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { Logger } from '../../ports/logger.ts';
import type { InvalidateReviewedMarksUseCasePort } from '../../ports/invalidate-reviewed-marks-use-case-port.ts';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';

export class EditFileUseCase {
  private readonly access: WorktreeAccess;
  private readonly editFile: EditFileService;
  private readonly invalidateReviewedMarks: InvalidateReviewedMarksUseCasePort;
  private readonly events: EventPublisher;
  private readonly editAnnouncements: EditAnnouncementWriter;
  private readonly logger: Logger;

  constructor(
    access: WorktreeAccess,
    editFile: EditFileService,
    invalidateReviewedMarks: InvalidateReviewedMarksUseCasePort,
    events: EventPublisher,
    editAnnouncements: EditAnnouncementWriter,
    logger: Logger,
  ) {
    this.access = access;
    this.editFile = editFile;
    this.invalidateReviewedMarks = invalidateReviewedMarks;
    this.events = events;
    this.editAnnouncements = editAnnouncements;
    this.logger = logger;
  }

  execute(
    input: WorktreeParams & EditFileRequest,
  ): Effect.Effect<EditFileResponse, EditFileFailure | WorktreeAccessFailure> {
    return Effect.gen({ self: this }, function* () {
      const { worktreeId } = input;
      const paths =
        input.kind === 'move'
          ? [input.path, input.destination]
          : input.kind === 'copy'
            ? [input.destination]
            : [input.path];
      return yield* this.access.write(
        worktreeId,
        (worktree) =>
          this.editFile.execute({ worktreeId: worktree.id, command: input }),
        () => this.announce(worktreeId, paths),
      );
    });
  }

  private announce(worktreeId: string, paths: string[]): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      this.editAnnouncements.announce({ worktreeId, paths });
      const invalidated = this.invalidateReviewedMarks.execute({
        worktreeId,
        paths,
      });
      yield* Effect.catchCause(invalidated, (cause) =>
        Effect.sync(() =>
          this.logger.failure({
            kind: 'reviewed-marks',
            worktreeId,
            error: Cause.squash(cause),
          }),
        ),
      );
      this.events.filesChanged({ worktreeId, paths });
    });
  }
}
