import type { ListWorktreePathsResponse } from '@porcelain/contracts/files';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  CheckWorktreeService,
  ListWorktreePathsService,
} from '@porcelain/files/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ListWorktreePathsUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly listWorktreePaths: ListWorktreePathsService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeService,
    listWorktreePaths: ListWorktreePathsService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.listWorktreePaths = listWorktreePaths;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: WorktreeParams,
    context: OperationContext,
  ): Promise<ListWorktreePathsResponse> {
    const check = { worktreeId: input.worktreeId, purpose: 'reading' } as const;
    return this.lanes.run(
      this.laneKeys.worktree(input.worktreeId),
      'read',
      async ({ signal }) => {
        await this.checkWorktree.execute(check, signal);
        const result = await this.listWorktreePaths.execute(input, signal);
        await this.checkWorktree.execute(check, signal);
        return result;
      },
      { callerSignal: context.signal },
    );
  }
}
