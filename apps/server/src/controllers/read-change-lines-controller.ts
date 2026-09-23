import type { ReadChangeLinesResponse } from '@porcelain/contracts/changes';
import type { ChangeLineRange } from '@porcelain/changes/models';
import type { ReadChangeLinesService } from '@porcelain/changes/services';

type RunWorktreeRead = <T>(
  worktreeId: string,
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

type OpenLines = (
  worktreeId: string,
  signal?: AbortSignal,
) => Promise<{ environmentId: string; service: ReadChangeLinesService }>;

export class ReadChangeLinesController {
  private readonly openLines: OpenLines;
  private readonly runRead: RunWorktreeRead;

  constructor(openLines: OpenLines, runRead: RunWorktreeRead) {
    this.openLines = openLines;
    this.runRead = runRead;
  }

  execute(
    input: ChangeLineRange & { worktreeId: string },
    context: { signal?: AbortSignal },
  ): Promise<ReadChangeLinesResponse> {
    const { worktreeId, ...range } = input;
    return this.runRead(
      worktreeId,
      async (signal) => {
        signal.throwIfAborted();
        const { environmentId, service } = await this.openLines(
          worktreeId,
          signal,
        );
        return service.execute(environmentId, worktreeId, range, signal);
      },
      context.signal,
    );
  }
}
