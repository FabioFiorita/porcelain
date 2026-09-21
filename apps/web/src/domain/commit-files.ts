import { type Change, changePath } from './review';

export function commitFiles(changes: readonly Change[]) {
  const files = new Map<
    string,
    { path: string; paths: string[]; kind: string }
  >();
  for (const change of changes) {
    const path = changePath(change);
    // The change list fingerprints one logical path. Git understands that path
    // as the whole rename/delete/add operation, so the write and expectation
    // must use the same path instead of inventing a second unfingerprinted one.
    if (!files.has(path))
      files.set(path, {
        path,
        paths: [path],
        kind: 'kind' in change ? change.kind : 'changed',
      });
  }
  return [...files.values()];
}
