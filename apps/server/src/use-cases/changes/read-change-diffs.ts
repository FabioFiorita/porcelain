import type { ReadEnvironmentService } from '@porcelain/access/services';
import type {
  ReadChangeDiffsService,
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import {
  SelectionMismatchError,
  UnnamedDiffSelectionError,
} from '@porcelain/changes/errors';
import type { DiffSelectionProblem } from '@porcelain/changes/models';
import {
  diffSelectionProblem,
  matchDiffSelections,
  observationProblem,
} from '@porcelain/changes/rules';
import type {
  ReadChangeDiffsRequest,
  ReadChangeDiffsResponse,
} from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import { WorktreeChangedError } from '@porcelain/kernel/errors';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ReadChangeDiffsUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly readWorktreeStatus: ReadWorktreeStatusService;
  private readonly readChangeFingerprints: ReadChangeFingerprintsService;
  private readonly readChangeDiffs: ReadChangeDiffsService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeService,
    readWorktreeStatus: ReadWorktreeStatusService,
    readChangeFingerprints: ReadChangeFingerprintsService,
    readChangeDiffs: ReadChangeDiffsService,
    readEnvironment: ReadEnvironmentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.readWorktreeStatus = readWorktreeStatus;
    this.readChangeFingerprints = readChangeFingerprints;
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
      { worktreeId, purpose: 'reading' },
      context.signal,
    );
    return this.lanes.run(
      this.laneKeys.repository(worktree),
      'read',
      async ({ signal }) => {
        const before = await this.readWorktreeStatus.execute(
          { worktreeId },
          signal,
        );
        const selection = { expectedFiles, selections, status: before };
        const problem = diffSelectionProblem(selection);
        if (problem) throw this.failure(problem);
        const selected = matchDiffSelections(selection);
        const observed = await this.readChangeFingerprints.execute(
          { worktreeId, comparisons: before.changes, paths: selected.paths },
          signal,
        );
        const changed = observationProblem({
          expectedStatusToken,
          expectedFiles,
          statusToken: before.statusToken,
          fingerprints: observed,
          previousStamp: undefined,
        });
        if (changed) throw this.failure(changed);
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
        const moved = observationProblem({
          expectedStatusToken,
          expectedFiles,
          statusToken: after.statusToken,
          fingerprints: reobserved,
          previousStamp: observed.stamp,
        });
        if (moved) throw this.failure(moved);
        await this.checkWorktree.execute(
          { worktreeId, purpose: 'reading' },
          signal,
        );
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

  private failure(problem: DiffSelectionProblem): Error {
    switch (problem.kind) {
      case 'unnamed-selection':
        return new UnnamedDiffSelectionError();
      case 'selection-mismatch':
        return new SelectionMismatchError();
      case 'worktree-changed':
        return new WorktreeChangedError();
    }
  }
}
