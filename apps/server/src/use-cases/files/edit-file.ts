import type { EditFileResponse } from '@porcelain/contracts/files';
import type { EditFileInput } from '@porcelain/files/models';
import type { EditFileService } from '@porcelain/files/services';
import type { InvalidateReviewedMarksService } from '@porcelain/reviews/services';
import type { AnnouncedEditStore } from '../../ports/announced-edit-store.ts';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';
import type { WorktreeCheck } from '../../runtime/worktree-check.ts';

export class EditFileUseCase {
  private readonly checkWorktree: WorktreeCheck;
  private readonly editFile: EditFileService;
  private readonly invalidateReviewedMarks: InvalidateReviewedMarksService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;
  private readonly announcedEdits: AnnouncedEditStore;

  constructor(
    checkWorktree: WorktreeCheck,
    editFile: EditFileService,
    invalidateReviewedMarks: InvalidateReviewedMarksService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
    announcedEdits: AnnouncedEditStore,
  ) {
    this.checkWorktree = checkWorktree;
    this.editFile = editFile;
    this.invalidateReviewedMarks = invalidateReviewedMarks;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
    this.announcedEdits = announcedEdits;
  }

  async execute(
    input: EditFileInput,
    context: OperationContext,
  ): Promise<EditFileResponse> {
    const worktree = await this.checkWorktree.execute(
      { worktreeId: input.worktreeId, purpose: 'writing' },
      context,
    );
    const paths =
      input.command.kind === 'move'
        ? [input.command.path, input.command.destination]
        : [input.command.path];
    const result = await this.lanes.run(
      this.laneKeys.repository(worktree),
      'write',
      async ({ signal }) => {
        const edited = await this.editFile.execute(input, signal);
        await this.checkWorktree.execute(
          { worktreeId: input.worktreeId, purpose: 'writing' },
          { signal },
        );
        this.invalidateReviewedMarks.execute({
          worktreeId: input.worktreeId,
          paths,
        });
        return edited;
      },
      { callerSignal: context.signal },
    );
    this.events.filesChanged({ worktreeId: input.worktreeId, paths });
    this.announcedEdits.save({ worktreeId: input.worktreeId, paths });
    return result;
  }
}
