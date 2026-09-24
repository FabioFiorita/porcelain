import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { ReadChangeLinesService } from '@porcelain/changes/services';
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

export class ReadChangeLinesUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly readTextFile: ReadTextFileService;
  private readonly readChangeLines: ReadChangeLinesService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    readTextFile: ReadTextFileService,
    readChangeLines: ReadChangeLinesService,
    readEnvironment: ReadEnvironmentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.readTextFile = readTextFile;
    this.readChangeLines = readChangeLines;
    this.readEnvironment = readEnvironment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
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
        const lines = this.readChangeLines.execute({
          path,
          from,
          to,
          at,
          text,
        });
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
