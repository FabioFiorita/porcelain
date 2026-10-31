import type { ListDirectoryResponse as Directory } from '@porcelain/contracts/files';

const pathCollator = new Intl.Collator();
const comparePaths = (left: string, right: string) =>
  pathCollator.compare(left, right);

export type FileTreeEntry = {
  path: string;
  kind: Directory['entries'][number]['kind'];
  ignored?: boolean;
  target?: string;
};

function fileTreeEntries(directory: Directory): FileTreeEntry[] {
  const prefix = directory.path ? `${directory.path}/` : '';
  return directory.entries.map((entry) => ({
    path: `${prefix}${entry.name}${entry.kind === 'directory' ? '/' : ''}`,
    kind: entry.kind,
    ...(entry.ignored ? { ignored: true } : {}),
    ...(entry.target === undefined ? {} : { target: entry.target }),
  }));
}

export function fileTreeAncestors(path: string): string[] {
  const segments = path.split('/').filter(Boolean);
  return segments
    .slice(0, -1)
    .map((_, index) => segments.slice(0, index + 1).join('/'));
}

export function fileTreeExpansion(
  entries: readonly Pick<FileTreeEntry, 'path' | 'kind'>[],
  open: ReadonlySet<string>,
  known: ReadonlySet<string>,
): string[] {
  const normalize = (path: string) => path.replace(/\/$/, '');
  const normalizedOpen = new Set([...open].map(normalize));
  const normalizedKnown = new Set([...known].map(normalize));
  const directories = entries
    .filter((entry) => entry.kind === 'directory')
    .map((entry) => normalize(entry.path))
    .sort(comparePaths);
  const expanded = new Set(
    directories.filter((path) => normalizedOpen.has(path)),
  );
  const childCounts = new Map<string, number>();
  for (const entry of entries) {
    const parent = fileTreeAncestors(entry.path).at(-1);
    if (parent) childCounts.set(parent, (childCounts.get(parent) ?? 0) + 1);
  }
  for (const path of directories) {
    const parent = fileTreeAncestors(path).at(-1);
    if (
      !normalizedKnown.has(path) &&
      parent &&
      expanded.has(parent) &&
      childCounts.get(parent) === 1
    )
      expanded.add(path);
  }
  return [...expanded].filter((path) =>
    fileTreeAncestors(path).every((parent) => expanded.has(parent)),
  );
}

export function mergeFileTreeEntries(
  directories: readonly Directory[],
): FileTreeEntry[] {
  const responses = new Map(
    directories.map((directory) => [directory.path, directory]),
  );
  const entries = new Map<string, FileTreeEntry>();
  const pending = responses.has('') ? [''] : [];
  for (const path of pending) {
    const directory = responses.get(path);
    if (!directory) continue;
    for (const entry of fileTreeEntries(directory)) {
      entries.set(entry.path, entry);
      if (entry.kind === 'directory') {
        const child = entry.path.replace(/\/$/, '');
        if (responses.has(child)) pending.push(child);
      }
    }
  }
  return [...entries.values()].sort((left, right) =>
    comparePaths(left.path, right.path),
  );
}

export function visibleFileTreeRows(
  entries: readonly FileTreeEntry[],
  expanded: ReadonlySet<string>,
): { entry: FileTreeEntry; depth: number }[] {
  return entries
    .map((entry) => ({
      entry,
      ancestors: fileTreeAncestors(entry.path),
      parts: entry.path.replace(/\/$/, '').split('/'),
    }))
    .filter(({ ancestors }) =>
      ancestors.every((ancestor) => expanded.has(ancestor)),
    )
    .sort((left, right) => {
      const leftParts = left.parts;
      const rightParts = right.parts;
      for (
        let index = 0;
        index < Math.min(leftParts.length, rightParts.length);
        index += 1
      ) {
        if (leftParts[index] === rightParts[index]) continue;
        const leftFolder =
          index < leftParts.length - 1 || left.entry.kind === 'directory';
        const rightFolder =
          index < rightParts.length - 1 || right.entry.kind === 'directory';
        return (
          Number(rightFolder) - Number(leftFolder) ||
          comparePaths(leftParts[index] ?? '', rightParts[index] ?? '')
        );
      }
      return leftParts.length - rightParts.length;
    })
    .map(({ entry, ancestors }) => ({ entry, depth: ancestors.length }));
}
