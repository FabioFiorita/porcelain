import type {
  ReadTextFileQuery,
  ReadTextFileResponse,
} from '@porcelain/contracts/files';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ReadTextFileService } from '@porcelain/files/services';
import type { CheckWorktreeService } from '@porcelain/projects/services';
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

  async execute(
    input: WorktreeParams & ReadTextFileQuery,
    context: OperationContext,
  ): Promise<ReadTextFileResponse> {
    const worktree = await this.checkWorktree.execute(
      { worktreeId: input.worktreeId, purpose: 'reading' },
      context.signal,
    );
    return this.lanes.run(
      this.laneKeys.repository(worktree),
      'read',
      async ({ signal }) => {
        const result = await this.readTextFile.execute(input, signal);
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
