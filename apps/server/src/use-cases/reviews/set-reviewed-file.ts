import type {
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import type {
  SetReviewedFileRequest,
  SetReviewedFileResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { CheckWorktreeService } from '@porcelain/files/services';
import type { SetReviewedFilesService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class SetReviewedFileUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly readWorktreeStatus: ReadWorktreeStatusService;
  private readonly readChangeFingerprints: ReadChangeFingerprintsService;
  private readonly setReviewedFiles: SetReviewedFilesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: CheckWorktreeService,
    readWorktreeStatus: ReadWorktreeStatusService,
    readChangeFingerprints: ReadChangeFingerprintsService,
    setReviewedFiles: SetReviewedFilesService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktree = checkWorktree;
    this.readWorktreeStatus = readWorktreeStatus;
    this.readChangeFingerprints = readChangeFingerprints;
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
        await this.checkWorktree.execute(
          { worktreeId, purpose: 'writing' },
          signal,
        );
        const status = await this.readWorktreeStatus.execute(
          { worktreeId },
          signal,
        );
        const { changes } = await this.readChangeFingerprints.execute(
          { worktreeId, comparisons: status.changes, paths: undefined },
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
    return result;
  }
}
