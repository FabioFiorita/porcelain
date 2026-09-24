import type { DirectoryEntry } from '../models/directory-entry.ts';

export function withoutGitDirectory(
  entries: readonly DirectoryEntry[],
): DirectoryEntry[] {
  return entries.filter((entry) => entry.name.toLowerCase() !== '.git');
}
