import { gitDirectoryName } from './git-directory-name.ts';

export function withoutGitDirectory<Entry extends { name: string }>(
  entries: readonly Entry[],
): Entry[] {
  return entries.filter(
    (entry) => entry.name.toLowerCase() !== gitDirectoryName(),
  );
}
