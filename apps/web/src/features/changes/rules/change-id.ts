import { changePath, type Change } from './changes';

export function changeId(change: Change) {
  return `change:${change.scope}:${changePath(change)}`;
}
