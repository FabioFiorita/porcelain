import { Effect } from 'effect';
import { InvalidWorktreeInventoryError } from '../../shared/errors/invalid-worktree-inventory-error.ts';
import { UnsupportedRepositoryError } from '../../shared/errors/unsupported-repository-error.ts';

type WorktreeRecord = { path: string; branch: string | null };

export const parseWorktreeList = Effect.fn('Git.parseWorktreeList')(function* (
  output: string,
): Effect.fn.Return<
  WorktreeRecord[],
  UnsupportedRepositoryError | InvalidWorktreeInventoryError
> {
  const records: WorktreeRecord[] = [];
  for (const record of output.split('\0\0').filter(Boolean)) {
    const fields = record.split('\0');
    if (fields.includes('bare')) return yield* new UnsupportedRepositoryError();
    const path = fields
      .find((field) => field.startsWith('worktree '))
      ?.slice('worktree '.length);
    if (!path) return yield* new InvalidWorktreeInventoryError();
    records.push({
      path,
      branch:
        fields
          .find((field) => field.startsWith('branch '))
          ?.slice('branch '.length) ?? null,
    });
  }
  if (records.length === 0) return yield* new InvalidWorktreeInventoryError();
  return records;
});
