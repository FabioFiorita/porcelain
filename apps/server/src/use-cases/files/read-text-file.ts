import type {
  ReadTextFileQuery,
  ReadTextFileResponse,
} from '@porcelain/contracts/files';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ReadTextFileService } from '@porcelain/files/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class ReadTextFileUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly readTextFile: ReadTextFileService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
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
      { worktreeId: input.worktreeId, requireAvailableProject: false },
      context,
    );
    return this.lanes.runConsistent(
      this.laneKeys.repository(worktree),
      worktree,
      async ({ signal }) => {
        const result = await this.readTextFile.execute(input, signal);
        return result;
      },
      { callerSignal: context.signal },
    );
  }
}
