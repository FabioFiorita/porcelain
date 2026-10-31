import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { useConfirmedRead } from '@/shared/query/confirmed-read';
import {
  readDirectory,
  readDirectories,
  refreshDirectories,
} from '@porcelain/client/files';
import type { FilesScope } from '@porcelain/client/files/rules';
import { type Connection } from '@/shared/workspace/connection';
import type { PinnedDirectoryState } from '@porcelain/client/files/rules';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';

export function useDirectory(
  connection: Connection,
  scope: FilesScope,
  path: string,
) {
  return useConfirmedRead(readDirectory({ connection, scope, path })).value;
}
export function useDirectories(
  connection: Connection,
  scope: FilesScope,
  paths: readonly string[],
) {
  const selection = { connection, scope, paths };
  const results = useAtomValue(readDirectories(selection));
  const retry = useAtomSet(refreshDirectories(selection));
  const states = results.map((result, index): PinnedDirectoryState => {
    const path = paths[index] ?? '';
    if (AsyncResult.isFailure(result)) return { path, status: 'unavailable' };
    const value = Option.getOrUndefined(AsyncResult.value(result));
    return value
      ? { path, status: 'loaded', entries: value.entries }
      : { path, status: 'loading' };
  });
  return { results, states, retry };
}
