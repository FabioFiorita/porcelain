import type { ReadCommitFilesService } from '@porcelain/changes/services';
import type {
  ReadCommitFilesParams,
  ReadCommitFilesQuery,
  ReadCommitFilesResponse,
} from '@porcelain/contracts/changes';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class ReadCommitFilesUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly readCommitFiles: ReadCommitFilesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    readCommitFiles: ReadCommitFilesService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.readCommitFiles = readCommitFiles;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: ReadCommitFilesParams & ReadCommitFilesQuery,
    context: OperationContext,
  ): Promise<ReadCommitFilesResponse> {
    const { worktreeId, oid, parent } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    return this.lanes.runConsistent(
      this.laneKeys.repository(worktree),
      worktree,
      async ({ signal }) => {
        const files = await this.readCommitFiles.execute(
          { worktreeId, oid, parent },
          signal,
        );
        return files;
      },
      { callerSignal: context.signal },
    );
  }
}
