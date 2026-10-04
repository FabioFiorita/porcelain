import { changePath, type Change } from './changes.ts';

export function changeId(change: Change) {
  return `change:${change.scope}:${changePath(change)}`;
}
