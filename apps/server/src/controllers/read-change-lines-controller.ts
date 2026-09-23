import type { ReadEnvironmentService } from '@porcelain/access/services';
import type {
  ConfirmWorktreeService,
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
  private readonly confirmWorktree: ConfirmWorktreeService;
  private readonly readChangeLines: ReadChangeLinesService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    confirmWorktree: ConfirmWorktreeService,
    readChangeLines: ReadChangeLinesService,
    readEnvironment: ReadEnvironmentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.confirmWorktree = confirmWorktree;
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
        await this.confirmWorktree.execute({ worktreeId }, signal);
        const lines = await this.readChangeLines.execute(input, signal);
        await this.confirmWorktree.execute({ worktreeId }, signal);
        return {
          environmentId: this.readEnvironment.execute(),
          worktreeId,
          ...lines,
        };
      },
      { callerSignal: context.signal },
    );
  }
}
