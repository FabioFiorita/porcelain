import { withoutGitDirectory } from '@porcelain/kernel/rules';

type Listed = { name: string; kind: string };

function treeOrder(left: Listed, right: Listed) {
  const folders =
    Number(right.kind === 'directory') - Number(left.kind === 'directory');
  if (folders !== 0) return folders;
  if (left.name === right.name) return 0;
  return left.name < right.name ? -1 : 1;
}

export function firstListedEntries<Entry extends Listed>(
  entries: readonly Entry[],
  limit: number,
): { entries: Entry[]; omitted: number } {
  const listed = withoutGitDirectory(entries).toSorted(treeOrder);
  return {
    entries: listed.slice(0, limit),
    omitted: Math.max(0, listed.length - limit),
  };
}
