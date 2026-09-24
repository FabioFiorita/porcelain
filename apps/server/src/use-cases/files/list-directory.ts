import type {
  ListDirectoryQuery,
  ListDirectoryResponse,
} from '@porcelain/contracts/files';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ListDirectoryService } from '@porcelain/files/services';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ListDirectoryUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly listDirectory: ListDirectoryService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeService,
    listDirectory: ListDirectoryService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.listDirectory = listDirectory;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: WorktreeParams & ListDirectoryQuery,
    context: OperationContext,
  ): Promise<ListDirectoryResponse> {
    return this.lanes.run(
      this.laneKeys.worktree(input.worktreeId),
      'read',
      async ({ signal }) => {
        await this.checkWorktree.execute(
          { worktreeId: input.worktreeId, purpose: 'reading' },
          signal,
        );
        const result = await this.listDirectory.execute(input, signal);
        await this.checkWorktree.execute(
          { worktreeId: input.worktreeId, purpose: 'reading' },
          signal,
        );
        return result;
      },
      { callerSignal: context.signal },
    );
  }
}
