import type { ReadEnvironmentService } from '@porcelain/access/services';
import type {
  ReadChangeLinesService,
  ReadHeadTextService,
} from '@porcelain/changes/services';
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

export class ReadChangeLinesUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly readHeadText: ReadHeadTextService;
  private readonly readTextFile: ReadTextFileService;
  private readonly readChangeLines: ReadChangeLinesService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeService,
    readHeadText: ReadHeadTextService,
    readTextFile: ReadTextFileService,
    readChangeLines: ReadChangeLinesService,
    readEnvironment: ReadEnvironmentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.readHeadText = readHeadText;
    this.readTextFile = readTextFile;
    this.readChangeLines = readChangeLines;
    this.readEnvironment = readEnvironment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
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
        const lines = this.readChangeLines.execute({
          path,
          from,
          to,
          at,
          text,
        });
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
