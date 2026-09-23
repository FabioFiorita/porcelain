import type {
  ListDirectoryQuery,
  ListDirectoryResponse,
} from '@porcelain/contracts/files';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  CheckWorktreeService,
  ListDirectoryService,
} from '@porcelain/files/services';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class ListDirectoryController {
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
    const check = { worktreeId: input.worktreeId, purpose: 'reading' } as const;
    return this.lanes.run(
      this.laneKeys.worktree(input.worktreeId),
      'read',
      async ({ signal }) => {
        await this.checkWorktree.execute(check, signal);
        const result = await this.listDirectory.execute(input, signal);
        await this.checkWorktree.execute(check, signal);
        return result;
      },
      { callerSignal: context.signal },
    );
  }
}
