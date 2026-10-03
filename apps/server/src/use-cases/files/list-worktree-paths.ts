import type { ListWorktreePathsResponse } from '@porcelain/contracts/files';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ListWorktreePathsService } from '@porcelain/files/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class ListWorktreePathsUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly listWorktreePaths: ListWorktreePathsService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    listWorktreePaths: ListWorktreePathsService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.listWorktreePaths = listWorktreePaths;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: WorktreeParams,
    context: OperationContext,
  ): Promise<ListWorktreePathsResponse> {
    const worktree = await this.checkWorktree.execute(
      { worktreeId: input.worktreeId, requireAvailableProject: false },
      context,
    );
    return this.lanes.runConsistent(
      this.laneKeys.repository(worktree),
      worktree,
      async ({ signal }) => {
        const result = await this.listWorktreePaths.execute(input, signal);
        return result;
      },
      { callerSignal: context.signal },
    );
  }
}
