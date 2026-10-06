import { Effect } from 'effect';
import { Reactivity } from 'effect/reactivity';
import { nativeOperation } from '@porcelain/effects';
import type { QueryClient } from '@tanstack/query-core';
import type { EditFileRequest as FileEdit } from '@porcelain/contracts/files';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
const parentOf = (path: string) => path.split('/').slice(0, -1).join('/');

export function refreshFileEdit(
  client: QueryClient,
  connection: RuntimeConnection,
  scope: WorktreeScope,
  input: FileEdit,
) {
  return Effect.gen(function* () {
    const key = (surface: readonly unknown[]) =>
      queryKeys.reviewSurface(connection.environmentId, scope, surface);
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
      client.removeQueries({
        queryKey: queryKeys.withIdentity(queryKey, connection),
        exact: true,
      });
    yield* Effect.sync(() =>
      connection.runtime.runSync(
        Reactivity.invalidate([...wanted.values(), ...dropped]),
      ),
    );
    yield* Effect.forEach(
      [...wanted.values()],
      (queryKey) =>
        nativeOperation(() =>
          client.invalidateQueries({
            queryKey: queryKeys.withIdentity(queryKey, connection),
            exact: true,
          }),
        ),
      { concurrency: 'unbounded', discard: true },
    );
  });
}
