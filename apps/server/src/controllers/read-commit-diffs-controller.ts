import type { CommitDiffsResponse } from '@porcelain/contracts/changes';
import type { CommitHistoryReader } from '../runtime/commit-history-reader.ts';

type RunWorktreeRead = <T>(
  worktreeId: string,
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

export class ReadCommitDiffsController {
  private readonly history: CommitHistoryReader;
  private readonly run: RunWorktreeRead;

  constructor(history: CommitHistoryReader, run: RunWorktreeRead) {
    this.history = history;
    this.run = run;
  }

  execute(
    input: {
      worktreeId: string;
      oid: string;
      parent?: number | undefined;
      paths: string[][];
    },
    context: { signal?: AbortSignal | undefined },
  ): Promise<CommitDiffsResponse> {
    const { worktreeId, oid, parent, paths } = input;
    return this.run(
      worktreeId,
      async (signal) => {
        const sections = await this.history.readCommitDiffs(
          worktreeId,
          {
            oid,
            ...(parent === undefined ? {} : { parent }),
            paths: paths.flat(),
          },
          signal,
        );
        return {
          commitOid: oid,
          diffs: paths.map((entry) => ({
            paths: [...entry],
            content:
              sections === null
                ? { kind: 'omitted' as const, reason: 'size-limit' as const }
                : (sections.get(entry.join('\0')) ?? {
                    kind: 'metadata-only' as const,
                    patch: '',
                  }),
          })),
        };
      },
      context.signal,
    );
  }
}
