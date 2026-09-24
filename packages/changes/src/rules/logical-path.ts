import type { ChangeComparison } from '@porcelain/kernel/models';

export function logicalPath(change: ChangeComparison): string {
  if (change.scope === 'untracked' || change.scope === 'unmerged')
    return change.path;
  return change.newPath ?? change.oldPath ?? '';
}
