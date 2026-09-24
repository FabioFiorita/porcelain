import type { ReadEnvironmentService } from '@porcelain/access/services';
import { lineRangeProblem, sliceChangeLines } from '@porcelain/changes/rules';
import { InvalidLineRangeError } from '@porcelain/kernel/errors';
import type {
  ReadChangeLinesQuery,
  ReadChangeLinesResponse,
} from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ReadTextFileService } from '@porcelain/files/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export type ReadChangeLinesOptions = { maxLines: number };

export class ReadChangeLinesUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly readTextFile: ReadTextFileService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly options: ReadChangeLinesOptions;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    readTextFile: ReadTextFileService,
    readEnvironment: ReadEnvironmentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    options: ReadChangeLinesOptions,
  ) {
    this.checkWorktree = checkWorktree;
    this.readTextFile = readTextFile;
    this.readEnvironment = readEnvironment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.options = options;
  }

  async execute(
    input: WorktreeParams & ReadChangeLinesQuery,
    context: OperationContext,
  ): Promise<ReadChangeLinesResponse> {
    const { worktreeId, path, from, to, at } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    return this.lanes.runConsistent(
      this.laneKeys.repository(worktree),
      worktree,
      async ({ signal }) => {
        const { text } = await this.readTextFile.execute(
          { worktreeId, path, at },
          signal,
        );
        const problem = lineRangeProblem({ from, to });
        if (problem) throw new InvalidLineRangeError();
        const lines = sliceChangeLines(
          { path, from, to, at, text },
          this.options.maxLines,
        );
        return {
          environmentId: this.readEnvironment.execute().environmentId,
          worktreeId,
          ...lines,
        };
      },
      { callerSignal: context.signal },
    );
  }
}
