import type { ChangeComparison } from '../models/change.ts';

export function logicalPath(change: ChangeComparison): string {
  if (change.scope === 'untracked' || change.scope === 'unmerged')
    return change.path;
  return change.newPath ?? change.oldPath ?? '';
}
