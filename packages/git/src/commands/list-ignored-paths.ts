import { runInspection } from '../read-inspection.ts';

/**
 * Top-level ignored files and collapsed ignored directories for a recursive
 * watcher. Git applies repository, global and worktree exclude rules here.
 */
export async function listIgnoredPaths(
  checkout: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const output = await runInspection(
    checkout,
    [
      'ls-files',
      '-z',
      '--others',
      '--ignored',
      '--exclude-standard',
      '--directory',
    ],
    signal,
    { maxBytes: 4 * 1024 * 1024 },
  );
  return output
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((path) => (path.endsWith('/') ? path.slice(0, -1) : path));
}
