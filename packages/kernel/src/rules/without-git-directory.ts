export function withoutGitDirectory<Entry extends { name: string }>(
  entries: readonly Entry[],
): Entry[] {
  return entries.filter((entry) => entry.name.toLowerCase() !== '.git');
}
