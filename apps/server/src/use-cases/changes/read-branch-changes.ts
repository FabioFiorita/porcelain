import type { ReadBranchChangesService } from '@porcelain/changes/services';
import type {
  ReadBranchChangesQuery,
  ReadBranchChangesResponse,
} from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class ReadBranchChangesUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly readBranchChanges: ReadBranchChangesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    readBranchChanges: ReadBranchChangesService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.readBranchChanges = readBranchChanges;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: WorktreeParams & ReadBranchChangesQuery,
    context: OperationContext,
  ): Promise<ReadBranchChangesResponse> {
    const { worktreeId, base } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    return this.lanes.runConsistent(
      this.laneKeys.repository(worktree),
      worktree,
      async ({ signal }) => {
        const changes = await this.readBranchChanges.execute(
          { worktreeId, base },
          signal,
        );
        return { worktreeId, ...changes };
      },
      { callerSignal: context.signal },
    );
  }
}
