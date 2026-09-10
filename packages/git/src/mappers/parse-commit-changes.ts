import type { CommitChange } from '../dtos/commit-history.ts';
import { ReadLimitExceededError } from '../errors/read-limit-exceeded-error.ts';
import { UnsupportedHistoryDataError } from '../errors/unsupported-history-data-error.ts';

const statuses = {
  A: 'added',
  D: 'deleted',
  M: 'modified',
  R: 'renamed',
  T: 'type-changed',
} as const;
export function parseCommitChanges(raw: string): CommitChange[] {
  const tokens = raw.split('\0');
  const changes: CommitChange[] = [];
  while (tokens.length > 1) {
    const header = tokens
      .shift()
      ?.match(/^:(\d{6}) (\d{6}) [0-9a-f]+ [0-9a-f]+ ([ADMRT])\d*$/);
    const path = tokens.shift();
    if (!header || path === undefined || !header[1] || !header[2])
      throw new UnsupportedHistoryDataError();
    const code = header[3] as keyof typeof statuses;
    const newPath = code === 'R' ? tokens.shift() : path;
    if (newPath === undefined) throw new UnsupportedHistoryDataError();
    changes.push({
      oldPath: code === 'A' ? null : path,
      newPath: code === 'D' ? null : newPath,
      oldMode: header[1],
      newMode: header[2],
      status: statuses[code],
      patch: { kind: 'text', text: '' },
    });
    if (changes.length > 500) throw new ReadLimitExceededError();
  }
  return changes;
}
export function attachCommitPatches(
  changes: CommitChange[],
  output: string,
): CommitChange[] {
  const patches = output.split(/(?=^diff --git )/m).filter(Boolean);
  // Git represents a type change as a deletion and addition in patch output,
  // while raw output retains a single T record for that path.
  const sectionCount = (change: CommitChange) =>
    change.status === 'type-changed' ? 2 : 1;
  const expectedSections = changes.reduce(
    (total, change) => total + sectionCount(change),
    0,
  );
  if (patches.length !== expectedSections)
    throw new UnsupportedHistoryDataError();
  return changes.map((change) => {
    const text = patches.splice(0, sectionCount(change)).join('');
    if (change.oldMode === '160000' || change.newMode === '160000')
      return { ...change, patch: { kind: 'submodule', text } };
    if (/^Binary files .* differ$/m.test(text))
      return { ...change, patch: { kind: 'binary' } };
    return { ...change, patch: { kind: 'text', text } };
  });
}
