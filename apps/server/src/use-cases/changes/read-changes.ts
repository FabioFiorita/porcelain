import type { ReadEnvironmentService } from '@porcelain/access/services';
import type {
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import type { ReadChangesResponse } from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ReadInterruptedGitActionService } from '@porcelain/git-actions/services';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ReadChangesUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly readWorktreeStatus: ReadWorktreeStatusService;
  private readonly readChangeFingerprints: ReadChangeFingerprintsService;
  private readonly readInterruptedGitAction: ReadInterruptedGitActionService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeService,
    readWorktreeStatus: ReadWorktreeStatusService,
    readChangeFingerprints: ReadChangeFingerprintsService,
    readInterruptedGitAction: ReadInterruptedGitActionService,
    readEnvironment: ReadEnvironmentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.readWorktreeStatus = readWorktreeStatus;
    this.readChangeFingerprints = readChangeFingerprints;
    this.readInterruptedGitAction = readInterruptedGitAction;
    this.readEnvironment = readEnvironment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: WorktreeParams,
    context: OperationContext,
  ): Promise<ReadChangesResponse> {
    const { worktreeId } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, purpose: 'reading' },
      context.signal,
    );
    return this.lanes.run<ReadChangesResponse>(
      this.laneKeys.repository(worktree),
      'read',
      async ({ signal }) => {
        const status = await this.readWorktreeStatus.execute(
          { worktreeId },
          signal,
        );
        const { changes } = await this.readChangeFingerprints.execute(
          { worktreeId, comparisons: status.changes, paths: undefined },
          signal,
        );
        await this.checkWorktree.execute({ worktreeId }, signal);
        const interrupted = this.readInterruptedGitAction.execute({
          worktreeId,
        });
        return {
          environmentId: this.readEnvironment.execute().environmentId,
          worktreeId,
          statusToken: status.statusToken,
          headOid: status.headOid,
          inProgress: status.inProgress,
          mergeHeadOid: status.mergeHeadOid,
          branch: status.branch,
          changes,
          ...(interrupted.kind === 'interrupted' && {
            interrupted: {
              requestId: interrupted.receipt.requestId,
              action: interrupted.receipt.action,
            },
          }),
        };
      },
      { callerSignal: context.signal },
    );
  }
}
