import type { ReadCommitFilesResponse } from '@porcelain/contracts/changes';
import type { CommitHistoryReader } from '../runtime/commit-history-reader.ts';

type RunWorktreeRead = <T>(
  worktreeId: string,
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

export class ReadCommitFilesController {
  private readonly history: CommitHistoryReader;
  private readonly run: RunWorktreeRead;

  constructor(history: CommitHistoryReader, run: RunWorktreeRead) {
    this.history = history;
    this.run = run;
  }

  execute(
    input: { worktreeId: string; oid: string; parent?: number | undefined },
    context: { signal?: AbortSignal | undefined },
  ): Promise<ReadCommitFilesResponse> {
    const { worktreeId, oid, parent } = input;
    return this.run(
      worktreeId,
      (signal) =>
        this.history.readCommitFiles(
          worktreeId,
          { oid, ...(parent === undefined ? {} : { parent }) },
          signal,
        ),
      context.signal,
    );
  }
}
