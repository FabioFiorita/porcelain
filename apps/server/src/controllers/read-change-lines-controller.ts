import type { ReadEnvironmentService } from '@porcelain/access/services';
import type {
  CheckWorktreeService,
  ReadChangeLinesService,
} from '@porcelain/changes/services';
import type {
  ReadChangeLinesQuery,
  ReadChangeLinesResponse,
} from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class ReadChangeLinesController {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly readChangeLines: ReadChangeLinesService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeService,
    readChangeLines: ReadChangeLinesService,
    readEnvironment: ReadEnvironmentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.readChangeLines = readChangeLines;
    this.readEnvironment = readEnvironment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: WorktreeParams & ReadChangeLinesQuery,
    context: OperationContext,
  ): Promise<ReadChangeLinesResponse> {
    const { worktreeId } = input;
    return this.lanes.run(
      this.laneKeys.worktree(worktreeId),
      'read',
      async ({ signal }) => {
        await this.checkWorktree.execute({ worktreeId }, signal);
        const lines = await this.readChangeLines.execute(input, signal);
        await this.checkWorktree.execute({ worktreeId }, signal);
        return {
          environmentId: this.readEnvironment.execute({}).environmentId,
          worktreeId,
          ...lines,
        };
      },
      { callerSignal: context.signal },
    );
  }
}
