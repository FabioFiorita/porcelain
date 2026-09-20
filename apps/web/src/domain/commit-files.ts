import { type Change, changePath } from './review';

export function commitFiles(changes: readonly Change[]) {
  const files = new Map<string, { path: string; paths: string[] }>();
  for (const change of changes) {
    const path = changePath(change);
    const existing = files.get(path)?.paths ?? [];
    const paths =
      'path' in change
        ? [change.path]
        : [change.oldPath, change.newPath].filter(
            (value): value is string => value !== null,
          );
    files.set(path, { path, paths: [...new Set([...existing, ...paths])] });
  }
  return [...files.values()];
}
