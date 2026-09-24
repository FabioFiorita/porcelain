import type {
  ReadTextFileQuery,
  ReadTextFileResponse,
} from '@porcelain/contracts/files';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  CheckWorktreeService,
  ReadTextFileService,
} from '@porcelain/files/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ReadTextFileUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly readTextFile: ReadTextFileService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeService,
    readTextFile: ReadTextFileService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.readTextFile = readTextFile;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: WorktreeParams & ReadTextFileQuery,
    context: OperationContext,
  ): Promise<ReadTextFileResponse> {
    const check = { worktreeId: input.worktreeId, purpose: 'reading' } as const;
    return this.lanes.run(
      this.laneKeys.worktree(input.worktreeId),
      'read',
      async ({ signal }) => {
        await this.checkWorktree.execute(check, signal);
        const result = await this.readTextFile.execute(input, signal);
        await this.checkWorktree.execute(check, signal);
        return result;
      },
      { callerSignal: context.signal },
    );
  }
}
