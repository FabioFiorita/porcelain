import type { ListDirectoryResponse as Directory } from '@porcelain/contracts/files';

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
  const directories = entries
    .filter((entry) => entry.kind === 'directory')
    .map((entry) => entry.path)
    .sort((left, right) => left.localeCompare(right));
  const expanded = new Set(directories.filter((path) => open.has(path)));
  const childCounts = new Map<string, number>();
  for (const entry of entries) {
    const parent = fileTreeAncestors(entry.path).at(-1);
    if (parent) childCounts.set(parent, (childCounts.get(parent) ?? 0) + 1);
  }
  for (const path of directories) {
    const parent = fileTreeAncestors(path).at(-1);
    if (
      !known.has(path) &&
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
    left.path.localeCompare(right.path),
  );
}

export function visibleFileTreeRows(
  entries: readonly FileTreeEntry[],
  expanded: ReadonlySet<string>,
): { entry: FileTreeEntry; depth: number }[] {
  return entries
    .filter((entry) =>
      fileTreeAncestors(entry.path).every((ancestor) => expanded.has(ancestor)),
    )
    .sort((left, right) => {
      const leftParts = left.path.replace(/\/$/, '').split('/');
      const rightParts = right.path.replace(/\/$/, '').split('/');
      for (
        let index = 0;
        index < Math.min(leftParts.length, rightParts.length);
        index += 1
      ) {
        if (leftParts[index] === rightParts[index]) continue;
        const leftFolder =
          index < leftParts.length - 1 || left.kind === 'directory';
        const rightFolder =
          index < rightParts.length - 1 || right.kind === 'directory';
        return (
          Number(rightFolder) - Number(leftFolder) ||
          (leftParts[index] ?? '').localeCompare(rightParts[index] ?? '')
        );
      }
      return leftParts.length - rightParts.length;
    })
    .map((entry) => ({ entry, depth: fileTreeAncestors(entry.path).length }));
}
