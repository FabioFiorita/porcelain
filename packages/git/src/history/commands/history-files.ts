import { Effect } from 'effect';
import type { RawDiffEntry } from '../../inspection/index.ts';
import type { CommitFile } from '../dtos/commit-history.ts';
import { ReadLimitExceededError } from '../../shared/errors/read-limit-exceeded-error.ts';
import { UnsupportedHistoryDataError } from '../../shared/errors/unsupported-history-data-error.ts';

const fileStatus = Effect.fn('Git.fileStatus')(function* (code: string) {
  switch (code) {
    case 'A':
      return 'added' as const;
    case 'D':
      return 'deleted' as const;
    case 'M':
      return 'modified' as const;
    case 'R':
      return 'renamed' as const;
    case 'T':
      return 'type-changed' as const;
    default:
      return yield* Effect.fail(new UnsupportedHistoryDataError());
  }
});

export const historyFiles = Effect.fn('Git.historyFiles')(function* <
  Entry extends RawDiffEntry,
  Result,
>(
  entries: readonly Entry[],
  maxFiles: number,
  project: (file: CommitFile, entry: Entry) => Result,
) {
  if (entries.length > maxFiles)
    return yield* Effect.fail(new ReadLimitExceededError());
  return yield* Effect.forEach(entries, (entry) =>
    Effect.gen(function* () {
      const status = yield* fileStatus(entry.status);
      return project(
        {
          oldPath: status === 'added' ? null : entry.oldPath,
          newPath: status === 'deleted' ? null : entry.newPath,
          oldMode: entry.oldMode,
          newMode: entry.newMode,
          status,
        },
        entry,
      );
    }),
  );
});
