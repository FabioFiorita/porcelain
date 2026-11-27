import { changePath, type Change } from './changes.ts';

type ListedChanges = {
  changes: readonly Change[];
  omittedChanges?: number | undefined;
};

export function changedFileCount(status: ListedChanges) {
  return (
    new Set(status.changes.map(changePath)).size + (status.omittedChanges ?? 0)
  );
}

export function shownChangesText(shown: number, omitted: number | undefined) {
  if (!omitted) return undefined;
  const total = shown + omitted;
  return `${shown.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} changes shown`;
}
