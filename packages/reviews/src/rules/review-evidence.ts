import type {
  ChangeComparison,
  FileChange,
  TrackedComparison,
} from '@porcelain/kernel/models';
import type {
  ReviewChange,
  ReviewDiff,
  ReviewDiffSelection,
  ReviewFiles,
  ReviewPatch,
  ReviewTextRead,
} from '../models/review-evidence.ts';
import type { CodePointer, LayerDraft } from '../models/review.ts';

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
  changes: readonly FileChange[],
): string[] {
  return [
    ...new Set([
      ...layers.flatMap((layer) =>
        layer.steps.map((step) => step.pointer.path),
      ),
      ...changes.map((change) => change.path),
    ]),
  ];
}

function tracked(
  comparison: ChangeComparison,
): comparison is TrackedComparison {
  return comparison.scope === 'staged' || comparison.scope === 'unstaged';
}

export function trackedComparisons(
  changes: readonly FileChange[],
): TrackedComparison[] {
  return changes.flatMap((change) => change.comparisons.filter(tracked));
}

export function reviewChanges(changes: readonly FileChange[]): ReviewChange[] {
  return changes.map((file) => ({
    path: file.path,
    untracked: file.comparisons.some((entry) => entry.scope === 'untracked'),
    deleted: file.comparisons.some(
      (entry) => tracked(entry) && entry.newPath === undefined,
    ),
  }));
}

export function reviewFiles(texts: readonly ReviewTextRead[]): ReviewFiles {
  return new Map(
    texts.flatMap((read): [string, string][] =>
      read.status === 'fulfilled' ? [[read.value.path, read.value.text]] : [],
    ),
  );
}

function selectionPath(selection: ReviewDiffSelection): string | undefined {
  return selection.newPath ?? selection.oldPath;
}

export function reviewPatches(diffs: readonly ReviewDiff[]): ReviewPatch[] {
  return diffs.flatMap((entry): ReviewPatch[] => {
    const path = selectionPath(entry.selection);
    if (path === undefined) return [];
    const scope = entry.selection.scope;
    return entry.content.kind === 'binary' || entry.content.kind === 'omitted'
      ? [{ path, scope, kind: 'binary' }]
      : [{ path, scope, kind: 'text', patch: entry.content.patch }];
  });
}
