import type { ReadEnvironmentService } from '@porcelain/access/services';
import type {
  CheckDiffSelectionService,
  ConfirmDiffObservationService,
  ReadChangeDiffsService,
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import type {
  ReadChangeDiffsRequest,
  ReadChangeDiffsResponse,
} from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class ReadChangeDiffsUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly readWorktreeStatus: ReadWorktreeStatusService;
  private readonly readChangeFingerprints: ReadChangeFingerprintsService;
  private readonly checkDiffSelection: CheckDiffSelectionService;
  private readonly confirmDiffObservation: ConfirmDiffObservationService;
  private readonly readChangeDiffs: ReadChangeDiffsService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    readWorktreeStatus: ReadWorktreeStatusService,
    readChangeFingerprints: ReadChangeFingerprintsService,
    checkDiffSelection: CheckDiffSelectionService,
    confirmDiffObservation: ConfirmDiffObservationService,
    readChangeDiffs: ReadChangeDiffsService,
    readEnvironment: ReadEnvironmentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.readWorktreeStatus = readWorktreeStatus;
    this.readChangeFingerprints = readChangeFingerprints;
    this.checkDiffSelection = checkDiffSelection;
    this.confirmDiffObservation = confirmDiffObservation;
    this.readChangeDiffs = readChangeDiffs;
    this.readEnvironment = readEnvironment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: WorktreeParams & ReadChangeDiffsRequest,
    context: OperationContext,
  ): Promise<ReadChangeDiffsResponse> {
    const { worktreeId, expectedStatusToken, expectedFiles, selections } =
      input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    return this.lanes.runConsistent(
      this.laneKeys.repository(worktree),
      worktree,
      async ({ signal }) => {
        const before = await this.readWorktreeStatus.execute(
          { worktreeId },
          signal,
        );
        const selected = this.checkDiffSelection.execute({
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
