import {
  selectionKey,
  type ChangeSelection,
  type ExpectedFile,
} from './changes';

type DiffBatch = {
  expectedFiles: ExpectedFile[];
  selections: ChangeSelection[];
};

const selectionPath = (selection: ChangeSelection) =>
  selection.newPath ?? selection.oldPath ?? '';

export function diffBatches(
  expectedFiles: readonly ExpectedFile[],
  selections: readonly ChangeSelection[],
  limit: number,
): DiffBatch[] {
  if (selections.length === 0) return [];
  const byPath = new Map<string, DiffBatch>();
  const entry = (path: string) => {
    const found = byPath.get(path) ?? { expectedFiles: [], selections: [] };
    byPath.set(path, found);
    return found;
  };
  for (const file of expectedFiles) entry(file.path).expectedFiles.push(file);
  for (const selection of selections)
    entry(selectionPath(selection)).selections.push(selection);
  const batches: DiffBatch[] = [];
  let current: DiffBatch = { expectedFiles: [], selections: [] };
  for (const path of [...byPath.keys()].sort((left, right) =>
    left.localeCompare(right),
  )) {
    const group = byPath.get(path) ?? { expectedFiles: [], selections: [] };
    if (
      current.selections.length > 0 &&
      (current.expectedFiles.length + group.expectedFiles.length > limit ||
        current.selections.length + group.selections.length > limit)
    ) {
      batches.push(current);
      current = { expectedFiles: [], selections: [] };
    }
    current.expectedFiles.push(...group.expectedFiles);
    current.selections.push(
      ...group.selections.toSorted((left, right) =>
        selectionKey(left).localeCompare(selectionKey(right)),
      ),
    );
  }
  batches.push(current);
  return batches;
}
