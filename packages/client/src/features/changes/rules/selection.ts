import type { Change, ChangeSelection } from './changes.ts';
export function diffSelection(change: Change): ChangeSelection | undefined {
  return change.scope === 'staged' || change.scope === 'unstaged'
    ? { scope: change.scope, oldPath: change.oldPath, newPath: change.newPath }
    : undefined;
}
