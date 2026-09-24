import type { ReadEnvironmentService } from '@porcelain/access/services';
import type {
  ReadBranchDetailsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import type { ReadGitStatusResponse } from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';
import type { SharedReads } from '../../runtime/shared-reads.ts';

export class ReadGitStatusUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly readWorktreeStatus: ReadWorktreeStatusService;
  private readonly readBranchDetails: ReadBranchDetailsService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly sharedReads: SharedReads<ReadGitStatusResponse>;

  constructor(
    checkWorktree: CheckWorktreeService,
    readWorktreeStatus: ReadWorktreeStatusService,
    readBranchDetails: ReadBranchDetailsService,
    readEnvironment: ReadEnvironmentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    sharedReads: SharedReads<ReadGitStatusResponse>,
  ) {
    this.checkWorktree = checkWorktree;
    this.readWorktreeStatus = readWorktreeStatus;
    this.readBranchDetails = readBranchDetails;
    this.readEnvironment = readEnvironment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.sharedReads = sharedReads;
  }

  execute(
    input: WorktreeParams,
    context: OperationContext,
  ): Promise<ReadGitStatusResponse> {
    const { worktreeId } = input;
    const lane = this.laneKeys.worktree(worktreeId);
    return this.sharedReads.run(
      `status\0${lane}\0${worktreeId}`,
      (shared) =>
        this.lanes.run<ReadGitStatusResponse>(
          lane,
          'read',
          async ({ signal }) => {
            await this.checkWorktree.execute({ worktreeId }, signal);
            const status = await this.readWorktreeStatus.execute(
              { worktreeId },
              signal,
            );
            const details = await this.readBranchDetails.execute(
              { worktreeId, branch: status.branch, headOid: status.headOid },
              signal,
            );
            await this.checkWorktree.execute({ worktreeId }, signal);
            return {
              environmentId: this.readEnvironment.execute().environmentId,
              worktreeId,
              statusToken: status.statusToken,
              branch: status.branch && {
                ...status.branch,
                remoteName: details.remoteName,
                sourceRef: details.sourceRef,
                upstreamOid: details.upstreamOid,
                stashes: details.stashes,
                discarded: details.discarded,
              },
              consistency: 'best-effort',
              headOid: status.headOid,
              inProgress: status.inProgress,
              mergeHeadOid: status.mergeHeadOid,
              headCommit: details.headCommit,
              changes: status.changes,
            };
          },
          { callerSignal: shared },
        ),
      context.signal,
    );
  }
}
