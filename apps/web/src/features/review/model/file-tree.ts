import type { Directory } from '@/features/review/model/review';

export type FileTreeEntry = {
  path: string;
  kind: Directory['entries'][number]['kind'];
  ignored?: boolean;
  target?: string;
};

export function fileTreeEntries(directory: Directory): FileTreeEntry[] {
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
