import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { ReadHeadTextService } from '@porcelain/changes/services';
import { lineRangeProblem, sliceChangeLines } from '@porcelain/changes/rules';
import { InvalidLineRangeError } from '@porcelain/kernel/errors';
import type {
  ReadChangeLinesQuery,
  ReadChangeLinesResponse,
} from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ReadTextFileService } from '@porcelain/files/services';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export type ReadChangeLinesOptions = { maxLines: number };

export class ReadChangeLinesUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly readHeadText: ReadHeadTextService;
  private readonly readTextFile: ReadTextFileService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly options: ReadChangeLinesOptions;

  constructor(
    checkWorktree: CheckWorktreeService,
    readHeadText: ReadHeadTextService,
    readTextFile: ReadTextFileService,
    readEnvironment: ReadEnvironmentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    options: ReadChangeLinesOptions,
  ) {
    this.checkWorktree = checkWorktree;
    this.readHeadText = readHeadText;
    this.readTextFile = readTextFile;
    this.readEnvironment = readEnvironment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.options = options;
  }

  execute(
    input: WorktreeParams & ReadChangeLinesQuery,
    context: OperationContext,
  ): Promise<ReadChangeLinesResponse> {
    const { worktreeId, path, from, to, at } = input;
    return this.lanes.run(
      this.laneKeys.worktree(worktreeId),
      'read',
      async ({ signal }) => {
        await this.checkWorktree.execute({ worktreeId }, signal);
        const { text } =
          at === 'head'
            ? await this.readHeadText.execute({ worktreeId, path }, signal)
            : await this.readTextFile.execute({ worktreeId, path }, signal);
        const problem = lineRangeProblem({ from, to });
        if (problem) throw new InvalidLineRangeError();
        const lines = sliceChangeLines(
          { path, from, to, at, text },
          this.options.maxLines,
        );
        await this.checkWorktree.execute({ worktreeId }, signal);
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
