import type { QueryClient } from '@tanstack/query-core';
import type { EditFileRequest as FileEdit } from '@porcelain/contracts/files';
import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { filesApi } from '../api.ts';

const parentOf = (path: string) => path.split('/').slice(0, -1).join('/');

export async function editFile(
  connection: WorktreeConnection,
  scope: WorktreeScope,
  input: FileEdit,
  signal: AbortSignal,
) {
  const result = await filesApi(connection).edit({
    worktreeId: scope.worktreeId,
    input,
    signal,
  });
  assertCurrentAnswer(signal);
  return result;
}

export async function refreshFileEdit(
  client: QueryClient,
  connection: WorktreeConnection,
  scope: WorktreeScope,
  input: FileEdit,
) {
  const key = (surface: readonly unknown[]) =>
    queryKeys.worktreeSurface(connection, scope, surface);
  const wanted = new Map<string, readonly unknown[]>();
  const want = (surface: readonly unknown[]) =>
    wanted.set(JSON.stringify(surface), key(surface));
  want(['changes']);
  const dropped: (readonly unknown[])[] = [];
  if (input.kind === 'write') want(['text', input.path]);
  if (input.kind === 'create') want(['directory', parentOf(input.path)]);
  if (input.kind === 'trash') {
    want(['directory', parentOf(input.path)]);
    dropped.push(key(['text', input.path]));
  }
  if (input.kind === 'move') {
    want(['directory', parentOf(input.path)]);
    want(['directory', parentOf(input.destination)]);
    dropped.push(key(['text', input.path]));
  }
  if (input.kind !== 'write') want(['paths']);
  for (const queryKey of dropped)
    client.removeQueries({ queryKey, exact: true });
  await Promise.all(
    [...wanted.values()].map((queryKey) =>
      client.invalidateQueries({ queryKey, exact: true }),
    ),
  );
}
