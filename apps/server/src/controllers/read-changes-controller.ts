import type { ReadEnvironmentService } from '@porcelain/access/services';
import type {
  CheckWorktreeService,
  DescribeWorktreeStateService,
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import type { ReadChangesResponse } from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ReadInterruptedGitActionService } from '@porcelain/git-actions/services';
import type { ReconcileReviewedFilesService } from '@porcelain/reviews/services';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class ReadChangesController {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly readWorktreeStatus: ReadWorktreeStatusService;
  private readonly readChangeFingerprints: ReadChangeFingerprintsService;
  private readonly reconcileReviewedFiles: ReconcileReviewedFilesService;
  private readonly readInterruptedGitAction: ReadInterruptedGitActionService;
  private readonly describeWorktreeState: DescribeWorktreeStateService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeService,
    readWorktreeStatus: ReadWorktreeStatusService,
    readChangeFingerprints: ReadChangeFingerprintsService,
    reconcileReviewedFiles: ReconcileReviewedFilesService,
    readInterruptedGitAction: ReadInterruptedGitActionService,
    describeWorktreeState: DescribeWorktreeStateService,
    readEnvironment: ReadEnvironmentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.readWorktreeStatus = readWorktreeStatus;
    this.readChangeFingerprints = readChangeFingerprints;
    this.reconcileReviewedFiles = reconcileReviewedFiles;
    this.readInterruptedGitAction = readInterruptedGitAction;
    this.describeWorktreeState = describeWorktreeState;
    this.readEnvironment = readEnvironment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: WorktreeParams,
    context: OperationContext,
  ): Promise<ReadChangesResponse> {
    const { worktreeId } = input;
    return this.lanes.run(
      this.laneKeys.worktree(worktreeId),
      'read',
      async ({ signal }) => {
        await this.checkWorktree.execute({ worktreeId }, signal);
        const status = await this.readWorktreeStatus.execute(
          { worktreeId },
          signal,
        );
        const { changes } = await this.readChangeFingerprints.execute(
          { worktreeId, comparisons: status.changes, paths: undefined },
          signal,
        );
        await this.checkWorktree.execute({ worktreeId }, signal);
        this.reconcileReviewedFiles.execute({
          worktreeId,
          fingerprints: new Map(
            changes.map((change) => [change.path, change.fingerprint]),
          ),
        });
        const interrupted = this.readInterruptedGitAction.execute({
          worktreeId,
        });
        return {
          environmentId: this.readEnvironment.execute({}).environmentId,
          worktreeId,
          statusToken: status.statusToken,
          headOid: status.headOid,
          inProgress: status.inProgress,
          mergeHeadOid: status.mergeHeadOid,
          branch: status.branch,
          changes,
          ...(interrupted && {
            interrupted: {
              requestId: interrupted.requestId,
              action: interrupted.action,
              gitState: this.describeWorktreeState.execute({
                changes,
                branch: status.branch,
              }),
            },
          }),
        };
      },
      { callerSignal: context.signal },
    );
  }
}
