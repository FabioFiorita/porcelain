import type {
  ConfirmWorktreeService,
  ReadCommitFilesService,
} from '@porcelain/changes/services';
import type {
  ReadCommitFilesParams,
  ReadCommitFilesQuery,
  ReadCommitFilesResponse,
} from '@porcelain/contracts/changes';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class ReadCommitFilesController {
  private readonly confirmWorktree: ConfirmWorktreeService;
  private readonly readCommitFiles: ReadCommitFilesService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    confirmWorktree: ConfirmWorktreeService,
    readCommitFiles: ReadCommitFilesService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.confirmWorktree = confirmWorktree;
    this.readCommitFiles = readCommitFiles;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: ReadCommitFilesParams & ReadCommitFilesQuery,
    context: OperationContext,
  ): Promise<ReadCommitFilesResponse> {
    const { worktreeId, oid, parent } = input;
    return this.lanes.run(
      this.laneKeys.worktree(worktreeId),
      'read',
      async ({ signal }) => {
        await this.confirmWorktree.execute({ worktreeId }, signal);
        const files = await this.readCommitFiles.execute(
          { worktreeId, oid, parent },
          signal,
        );
        await this.confirmWorktree.execute({ worktreeId }, signal);
        return files;
      },
      { callerSignal: context.signal },
    );
  }
}
