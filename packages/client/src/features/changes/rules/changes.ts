import type {
  ReadChangeDiffsRequest,
  ReadChangeDiffsResponse,
  ReadChangesResponse,
  ReadCommitFilesResponse,
} from '@porcelain/contracts/changes';

export type ChangesScope = { projectId: string; worktreeId: string };
export type Change =
  ReadChangesResponse['changes'][number]['comparisons'][number];
export type ChangeSelection =
  ReadChangeDiffsResponse['diffs'][number]['selection'];
export type DiffContent = ReadChangeDiffsResponse['diffs'][number]['content'];
export type ExpectedFile = ReadChangeDiffsRequest['expectedFiles'][number];
export type CommitFile = ReadCommitFilesResponse['files'][number];

export function changePath(change: Change) {
  return 'path' in change
    ? change.path
    : (change.newPath ?? change.oldPath ?? '');
}

export function selectionKey(selection: ChangeSelection) {
  return `${selection.scope}\n${selection.oldPath}\n${selection.newPath}`;
}

export function changeSelections(change: Change): ChangeSelection[] {
  return change.scope === 'staged' || change.scope === 'unstaged'
    ? [
        {
          scope: change.scope,
          oldPath: change.oldPath,
          newPath: change.newPath,
        },
      ]
    : [];
}

export function expectedDiffFiles(
  files: readonly ReadChangesResponse['changes'][number][],
): ExpectedFile[] {
  return files.flatMap((file) =>
    file.comparisons.some(
      (change) => change.scope === 'staged' || change.scope === 'unstaged',
    )
      ? [{ path: file.path, fingerprint: file.fingerprint }]
      : [],
  );
}
