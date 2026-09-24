import type { ReadEnvironmentService } from '@porcelain/access/services';
import type {
  CheckDiffObservationService,
  ReadChangeDiffsService,
  ReadChangeFingerprintsService,
  ReadDiffComparisonsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import type {
  ReadChangeDiffsRequest,
  ReadChangeDiffsResponse,
} from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ReadChangeDiffsUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly readWorktreeStatus: ReadWorktreeStatusService;
  private readonly readDiffComparisons: ReadDiffComparisonsService;
  private readonly readChangeFingerprints: ReadChangeFingerprintsService;
  private readonly checkDiffObservation: CheckDiffObservationService;
  private readonly readChangeDiffs: ReadChangeDiffsService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeService,
    readWorktreeStatus: ReadWorktreeStatusService,
    readDiffComparisons: ReadDiffComparisonsService,
    readChangeFingerprints: ReadChangeFingerprintsService,
    checkDiffObservation: CheckDiffObservationService,
    readChangeDiffs: ReadChangeDiffsService,
    readEnvironment: ReadEnvironmentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.readWorktreeStatus = readWorktreeStatus;
    this.readDiffComparisons = readDiffComparisons;
    this.readChangeFingerprints = readChangeFingerprints;
    this.checkDiffObservation = checkDiffObservation;
    this.readChangeDiffs = readChangeDiffs;
    this.readEnvironment = readEnvironment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: WorktreeParams & ReadChangeDiffsRequest,
    context: OperationContext,
  ): Promise<ReadChangeDiffsResponse> {
    const { worktreeId, expectedStatusToken, expectedFiles, selections } =
      input;
    return this.lanes.run(
      this.laneKeys.worktree(worktreeId),
      'read',
      async ({ signal }) => {
        await this.checkWorktree.execute({ worktreeId }, signal);
        const before = await this.readWorktreeStatus.execute(
          { worktreeId },
          signal,
        );
        const selected = this.readDiffComparisons.execute({
          expectedFiles,
          selections,
          status: before,
        });
        const observed = await this.readChangeFingerprints.execute(
          { worktreeId, comparisons: before.changes, paths: selected.paths },
          signal,
        );
        this.checkDiffObservation.execute({
          expectedStatusToken,
          expectedFiles,
          statusToken: before.statusToken,
          fingerprints: observed,
          previousStamp: undefined,
        });
        const diffs = await this.readChangeDiffs.execute(
          { worktreeId, comparisons: selected.comparisons },
          signal,
        );
        const after = await this.readWorktreeStatus.execute(
          { worktreeId },
          signal,
        );
        const reobserved = await this.readChangeFingerprints.execute(
          { worktreeId, comparisons: after.changes, paths: selected.paths },
          signal,
        );
        this.checkDiffObservation.execute({
          expectedStatusToken,
          expectedFiles,
          statusToken: after.statusToken,
          fingerprints: reobserved,
          previousStamp: observed.stamp,
        });
        await this.checkWorktree.execute({ worktreeId }, signal);
        return {
          environmentId: this.readEnvironment.execute().environmentId,
          worktreeId,
          statusToken: before.statusToken,
          diffs,
        };
      },
      { callerSignal: context.signal },
    );
  }
}
