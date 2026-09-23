import type {
  ChangeDiffs,
  ChangeSelection,
  DiffBatch,
  ReadChangesResult,
  ReviewChange,
  ReviewPatch,
} from '../models/review-evidence.ts';
import type { CodePointer, LayerDraft } from '../models/review.ts';

export const DIFF_BATCH_SIZE = 200;

export function textLines(text: string): string[] {
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

export function publishedLines(
  text: string | undefined,
  pointer: CodePointer,
): string[] {
  if (text === undefined) return [];
  const lines = textLines(text);
  return pointer.endLine <= lines.length
    ? lines.slice(pointer.startLine - 1, pointer.endLine)
    : [];
}

export function reviewPaths(
  layers: readonly Pick<LayerDraft, 'steps'>[],
  changes: ReadChangesResult | undefined,
): string[] {
  return [
    ...new Set([
      ...layers.flatMap((layer) =>
        layer.steps.map((step) => step.pointer.path),
      ),
      ...(changes?.changes.map((change) => change.path) ?? []),
    ]),
  ];
}

export function reviewChanges(result: ReadChangesResult): ReviewChange[] {
  return result.changes.map((file) => ({
    path: file.path,
    untracked: file.comparisons.some((entry) => entry.scope === 'untracked'),
    deleted: file.comparisons.some(
      (entry) =>
        (entry.scope === 'staged' || entry.scope === 'unstaged') &&
        entry.newPath === undefined,
    ),
  }));
}

function selectionPath(selection: ChangeSelection): string | undefined {
  return selection.newPath ?? selection.oldPath;
}

export function diffBatches(result: ReadChangesResult): DiffBatch[] {
  const selections = result.changes.flatMap((file) =>
    file.comparisons.flatMap((entry): ChangeSelection[] =>
      entry.scope === 'staged' || entry.scope === 'unstaged' ? [entry] : [],
    ),
  );
  const batches: DiffBatch[] = [];
  for (let offset = 0; offset < selections.length; offset += DIFF_BATCH_SIZE) {
    const batch = selections.slice(offset, offset + DIFF_BATCH_SIZE);
    const selected = new Set(batch.map(selectionPath));
    batches.push({
      selections: batch,
      expectedFiles: result.changes
        .filter((file) => selected.has(file.path))
        .map((file) => ({ path: file.path, fingerprint: file.fingerprint })),
    });
  }
  return batches;
}

export function reviewPatches(result: ChangeDiffs): ReviewPatch[] {
  return result.diffs.flatMap((entry): ReviewPatch[] => {
    const path = selectionPath(entry.selection);
    if (path === undefined) return [];
    const scope = entry.selection.scope;
    return entry.content.kind === 'binary' || entry.content.kind === 'omitted'
      ? [{ path, scope, kind: 'binary' }]
      : [{ path, scope, kind: 'text', patch: entry.content.patch }];
  });
}
