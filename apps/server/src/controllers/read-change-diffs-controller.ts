import type { ReadEnvironmentService } from '@porcelain/access/services';
import type {
  ConfirmDiffObservationService,
  ConfirmWorktreeService,
  ReadChangeDiffsService,
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
  SelectDiffComparisonsService,
} from '@porcelain/changes/services';
import type {
  ReadChangeDiffsRequest,
  ReadChangeDiffsResponse,
} from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class ReadChangeDiffsController {
  private readonly confirmWorktree: ConfirmWorktreeService;
  private readonly readWorktreeStatus: ReadWorktreeStatusService;
  private readonly selectDiffComparisons: SelectDiffComparisonsService;
  private readonly readChangeFingerprints: ReadChangeFingerprintsService;
  private readonly confirmDiffObservation: ConfirmDiffObservationService;
  private readonly readChangeDiffs: ReadChangeDiffsService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    confirmWorktree: ConfirmWorktreeService,
    readWorktreeStatus: ReadWorktreeStatusService,
    selectDiffComparisons: SelectDiffComparisonsService,
    readChangeFingerprints: ReadChangeFingerprintsService,
    confirmDiffObservation: ConfirmDiffObservationService,
    readChangeDiffs: ReadChangeDiffsService,
    readEnvironment: ReadEnvironmentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.confirmWorktree = confirmWorktree;
    this.readWorktreeStatus = readWorktreeStatus;
    this.selectDiffComparisons = selectDiffComparisons;
    this.readChangeFingerprints = readChangeFingerprints;
    this.confirmDiffObservation = confirmDiffObservation;
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
        await this.confirmWorktree.execute({ worktreeId }, signal);
        const before = await this.readWorktreeStatus.execute(
          { worktreeId },
          signal,
        );
        const selected = this.selectDiffComparisons.execute({
          expectedFiles,
          selections,
          status: before,
        });
        const observed = await this.readChangeFingerprints.execute(
          { worktreeId, comparisons: before.changes, paths: selected.paths },
          signal,
        );
        this.confirmDiffObservation.execute({
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
        this.confirmDiffObservation.execute({
          expectedStatusToken,
          expectedFiles,
          statusToken: after.statusToken,
          fingerprints: reobserved,
          previousStamp: observed.stamp,
        });
        await this.confirmWorktree.execute({ worktreeId }, signal);
        return {
          environmentId: this.readEnvironment.execute(),
          worktreeId,
          statusToken: before.statusToken,
          diffs,
        };
      },
      { callerSignal: context.signal },
    );
  }
}
