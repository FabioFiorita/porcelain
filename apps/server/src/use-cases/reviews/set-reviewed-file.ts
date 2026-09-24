import type {
  SetReviewedFileRequest,
  SetReviewedFileResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  CheckWorktreeAccessService,
  ReadCurrentChangesService,
  SetReviewedFilesService,
} from '@porcelain/reviews/services';
import type { EventPublisher } from '../../runtime/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class SetReviewedFileUseCase {
  private readonly checkWorktreeAccess: CheckWorktreeAccessService;
  private readonly readCurrentChanges: ReadCurrentChangesService;
  private readonly setReviewedFiles: SetReviewedFilesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktreeAccess: CheckWorktreeAccessService,
    readCurrentChanges: ReadCurrentChangesService,
    setReviewedFiles: SetReviewedFilesService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktreeAccess = checkWorktreeAccess;
    this.readCurrentChanges = readCurrentChanges;
    this.setReviewedFiles = setReviewedFiles;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(
    input: WorktreeParams & SetReviewedFileRequest,
    context: OperationContext,
  ): Promise<SetReviewedFileResponse> {
    const { worktreeId } = input;
    const result = await this.lanes.run(
      this.laneKeys.worktree(worktreeId),
      'write',
      async ({ signal }) => {
        await this.checkWorktreeAccess.execute(
          { worktreeId, intent: 'write' },
          signal,
        );
        const changes = await this.readCurrentChanges.execute(
          { worktreeId },
          signal,
        );
        return this.setReviewedFiles.execute({
          worktreeId,
          files: [{ path: input.path, fingerprint: input.fingerprint }],
          changes,
          onConflict: 'refuse',
        });
      },
      { callerSignal: context.signal },
    );
    this.events.worktreeChanged(worktreeId, 'reviewed');
    return { worktreeId: result.worktreeId, marks: result.marks };
  }
}
