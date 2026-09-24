import type {
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import type { ListReviewedFilesResponse } from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type {
  ListReviewedFilesService,
  ReconcileReviewedFilesService,
} from '@porcelain/reviews/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ListReviewedFilesUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly readWorktreeStatus: ReadWorktreeStatusService;
  private readonly readChangeFingerprints: ReadChangeFingerprintsService;
  private readonly reconcileReviewedFiles: ReconcileReviewedFilesService;
  private readonly listReviewedFiles: ListReviewedFilesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeService,
    readWorktreeStatus: ReadWorktreeStatusService,
    readChangeFingerprints: ReadChangeFingerprintsService,
    reconcileReviewedFiles: ReconcileReviewedFilesService,
    listReviewedFiles: ListReviewedFilesService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.readWorktreeStatus = readWorktreeStatus;
    this.readChangeFingerprints = readChangeFingerprints;
    this.reconcileReviewedFiles = reconcileReviewedFiles;
    this.listReviewedFiles = listReviewedFiles;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: WorktreeParams,
    context: OperationContext,
  ): Promise<ListReviewedFilesResponse> {
    const { worktreeId } = input;
    const lane = this.laneKeys.worktree(worktreeId);
    const changes = await this.lanes.run(
      lane,
      'read',
      async ({ signal }) => {
        await this.checkWorktree.execute(
          { worktreeId, purpose: 'reading' },
          signal,
        );
        const status = await this.readWorktreeStatus.execute(
          { worktreeId },
          signal,
        );
        return (
          await this.readChangeFingerprints.execute(
            { worktreeId, comparisons: status.changes, paths: undefined },
            signal,
          )
        ).changes;
      },
      { callerSignal: context.signal },
    );
    return this.lanes.run(
      lane,
      'write',
      async () => {
        this.reconcileReviewedFiles.execute({
          worktreeId,
          fingerprints: new Map(
            changes.map((change) => [change.path, change.fingerprint]),
          ),
        });
        return this.listReviewedFiles.execute({ worktreeId });
      },
      { callerSignal: context.signal },
    );
  }
}
