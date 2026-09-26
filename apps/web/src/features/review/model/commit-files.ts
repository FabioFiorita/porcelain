import { type Change, changePath } from '@/features/review/model/review';

export function commitFiles(changes: readonly Change[]) {
  const files = new Map<
    string,
    { path: string; paths: string[]; kind: string }
  >();
  for (const change of changes) {
    const path = changePath(change);
    if (!files.has(path))
      files.set(path, {
        path,
        paths: [path],
        kind: 'kind' in change ? change.kind : 'changed',
      });
  }
  return [...files.values()];
}
