import type { EditFileResponse } from '@porcelain/contracts/files';
import type { EditFileInput } from '@porcelain/files/models';
import type { EditFileService } from '@porcelain/files/services';
import type { ConfirmWorktreeService } from '@porcelain/projects/services';
import type { AnnouncedEditStore } from '../../ports/announced-edit-store.ts';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { Logger } from '../../ports/logger.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';
import type { ReviewedMarksInvalidation } from '../../runtime/reviewed-marks-invalidation.ts';
import type { WorktreeCheck } from '../../runtime/worktree-check.ts';

export class EditFileUseCase {
  private readonly checkWorktree: WorktreeCheck;
  private readonly confirmWorktree: ConfirmWorktreeService;
  private readonly editFile: EditFileService;
  private readonly invalidateReviewedMarks: ReviewedMarksInvalidation;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;
  private readonly announcedEdits: AnnouncedEditStore;
  private readonly logger: Logger;

  constructor(
    checkWorktree: WorktreeCheck,
    confirmWorktree: ConfirmWorktreeService,
    editFile: EditFileService,
    invalidateReviewedMarks: ReviewedMarksInvalidation,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
    announcedEdits: AnnouncedEditStore,
    logger: Logger,
  ) {
    this.checkWorktree = checkWorktree;
    this.confirmWorktree = confirmWorktree;
    this.editFile = editFile;
    this.invalidateReviewedMarks = invalidateReviewedMarks;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
    this.announcedEdits = announcedEdits;
    this.logger = logger;
  }

  async execute(
    input: EditFileInput,
    context: OperationContext,
  ): Promise<EditFileResponse> {
    const { worktreeId } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: true },
      context,
    );
    const paths =
      input.command.kind === 'move'
        ? [input.command.path, input.command.destination]
        : [input.command.path];
    const edited = await this.lanes.run(
      this.laneKeys.repository(worktree),
      'write',
      async ({ signal }) => {
        this.confirmWorktree.execute({ worktree });
        return this.editFile.execute(input, signal);
      },
      { callerSignal: context.signal },
    );
    this.announcedEdits.save({ worktreeId, paths });
    await this.invalidateReviewedMarks
      .execute({ worktreeId, paths }, {})
      .catch((error: unknown) =>
        this.logger.failure({ kind: 'reviewed-marks', worktreeId, error }),
      );
    this.events.filesChanged({ worktreeId, paths });
    return edited;
  }
}
