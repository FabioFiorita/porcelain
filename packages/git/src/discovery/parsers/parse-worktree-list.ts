import { InvalidWorktreeInventoryError } from '../errors/invalid-worktree-inventory-error.ts';
import { UnsupportedRepositoryError } from '../errors/unsupported-repository-error.ts';

export type WorktreeRecord = { path: string; branch: string | null };

export function parseWorktreeList(output: string): WorktreeRecord[] {
  const records = output
    .split('\0\0')
    .filter(Boolean)
    .map((record) => {
      const fields = record.split('\0');
      if (fields.includes('bare')) throw new UnsupportedRepositoryError();
      const path = fields
        .find((field) => field.startsWith('worktree '))
        ?.slice('worktree '.length);
      if (!path) throw new InvalidWorktreeInventoryError();
      return {
        path,
        branch:
          fields
            .find((field) => field.startsWith('branch '))
            ?.slice('branch '.length) ?? null,
      };
    });
  if (records.length === 0) throw new InvalidWorktreeInventoryError();
  return records;
}
