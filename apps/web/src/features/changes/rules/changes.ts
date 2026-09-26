import type {
  ReadChangeDiffsRequest,
  ReadChangeDiffsResponse,
  ReadChangesResponse,
  ReadCommitFilesResponse,
} from '@porcelain/contracts/changes';

export type ChangesScope = { projectId: string; worktreeId: string };
export type ChangesConnection = {
  environmentId: string;
  request: (signal?: AbortSignal) => { signal: AbortSignal };
};
export type Change =
  ReadChangesResponse['changes'][number]['comparisons'][number];
export type ChangeSelection =
  ReadChangeDiffsResponse['diffs'][number]['selection'];
export type DiffContent = ReadChangeDiffsResponse['diffs'][number]['content'];
export type ExpectedFile = ReadChangeDiffsRequest['expectedFiles'][number];
export type CommitFile = ReadCommitFilesResponse['files'][number];

export function requireChangesConnection(
  connection: ChangesConnection | null,
): ChangesConnection {
  if (!connection) throw new Error('A connected environment is required');
  return connection;
}

export function changePath(change: Change) {
  return 'path' in change
    ? change.path
    : (change.newPath ?? change.oldPath ?? '');
}

export function selectionKey(selection: ChangeSelection) {
  return `${selection.scope}\n${selection.oldPath}\n${selection.newPath}`;
}
