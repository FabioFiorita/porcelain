import type { ListDirectoryResponse } from '@porcelain/contracts/files';

export function directoryRequests(
  requested: readonly string[],
  directories: readonly ListDirectoryResponse[],
): string[] {
  const byPath = new Map(
    directories.map((directory) => [directory.path, directory]),
  );
  const reachable = (path: string): boolean => {
    if (!path) return true;
    const split = path.lastIndexOf('/');
    const parent = split < 0 ? '' : path.slice(0, split);
    if (!reachable(parent)) return false;
    const directory = byPath.get(parent);
    return (
      !directory ||
      directory.entries.some(
        (entry) =>
          entry.name === path.slice(split + 1) && entry.kind === 'directory',
      )
    );
  };
  return requested.filter(reachable);
}
