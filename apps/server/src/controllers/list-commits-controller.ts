import type { ListCommitsResponse } from '@porcelain/contracts/changes';
import type { CommitHistoryReader } from '../runtime/commit-history-reader.ts';

type RunWorktreeRead = <T>(
  worktreeId: string,
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

export class ListCommitsController {
  private readonly history: CommitHistoryReader;
  private readonly run: RunWorktreeRead;

  constructor(history: CommitHistoryReader, run: RunWorktreeRead) {
    this.history = history;
    this.run = run;
  }

  execute(
    input: {
      worktreeId: string;
      limit?: number | undefined;
      after?: string[] | undefined;
      tip?: string | undefined;
    },
    context: { signal?: AbortSignal | undefined },
  ): Promise<ListCommitsResponse> {
    const { worktreeId, limit, after, tip } = input;
    return this.run(
      worktreeId,
      (signal) =>
        this.history.listCommits(
          worktreeId,
          {
            ...(limit === undefined ? {} : { limit }),
            ...(after === undefined ? {} : { after }),
            ...(tip === undefined ? {} : { tip }),
          },
          signal,
        ),
      context.signal,
    );
  }
}
