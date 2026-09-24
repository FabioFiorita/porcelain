import type { ReadCommitFilesService } from '@porcelain/changes/services';
import type {
  ReadCommitFilesParams,
  ReadCommitFilesQuery,
  ReadCommitFilesResponse,
} from '@porcelain/contracts/changes';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ReadCommitFilesUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly readCommitFiles: ReadCommitFilesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeService,
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
      { worktreeId, purpose: 'reading' },
      context.signal,
    );
    return this.lanes.run(
      this.laneKeys.repository(worktree),
      'read',
      async ({ signal }) => {
        const files = await this.readCommitFiles.execute(
          { worktreeId, oid, parent },
          signal,
        );
        await this.checkWorktree.execute(
          { worktreeId, purpose: 'reading' },
          signal,
        );
        return files;
      },
      { callerSignal: context.signal },
    );
  }
}
