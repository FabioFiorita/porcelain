import type {
  ChangeDiffs,
  ChangeSelection,
  ExpectedFile,
  ReadChangesResult,
} from '@porcelain/changes/models';
import type { ReviewChange, ReviewPatch } from '@porcelain/reviews/models';

export type ReviewEvidenceReader = {
  readChanges(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ReadChangesResult>;
  readDiffs(
    worktreeId: string,
    statusToken: string,
    expectedFiles: readonly ExpectedFile[],
    selections: readonly ChangeSelection[],
    signal?: AbortSignal,
  ): Promise<ChangeDiffs>;
};

export function reviewChanges(list: ReadChangesResult): ReviewChange[] {
  return list.changes.map((file) => ({
    path: file.path,
    untracked: file.comparisons.some((entry) => entry.scope === 'untracked'),
    deleted: file.comparisons.some(
      (entry) =>
        (entry.scope === 'staged' || entry.scope === 'unstaged') &&
        entry.newPath === null,
    ),
  }));
}

export function reviewPatches(result: ChangeDiffs): ReviewPatch[] {
  const patches: ReviewPatch[] = [];
  for (const entry of result.diffs) {
    const path = entry.selection.newPath ?? entry.selection.oldPath;
    if (path === null) continue;
    if (entry.content.kind === 'binary' || entry.content.kind === 'omitted')
      patches.push({ path, scope: entry.selection.scope, kind: 'binary' });
    else
      patches.push({
        path,
        scope: entry.selection.scope,
        kind: 'text',
        patch: entry.content.patch,
      });
  }
  return patches;
}
