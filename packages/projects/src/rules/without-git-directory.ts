import type { FolderEntry } from '../models/project-folder.ts';

export function withoutGitDirectory(
  entries: readonly FolderEntry[],
): FolderEntry[] {
  return entries.filter((entry) => entry.name !== '.git');
}
