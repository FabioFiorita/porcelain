import { Atom, AsyncResult } from 'effect/reactivity';
import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { readWorktreePaths } from '@porcelain/client/files';
import type { FilesScope } from '@porcelain/client/files/rules';
import { type Connection } from '@/shared/workspace/connection';

const inactivePaths = Atom.make(
  AsyncResult.initial<Atom.Success<ReturnType<typeof readWorktreePaths>>>(),
);

export function useWorktreePaths(
  connection: Connection,
  scope: FilesScope,
  enabled = true,
) {
  const names = enabled
    ? readWorktreePaths({ connection, scope })
    : inactivePaths;
  return { result: useAtomValue(names), refresh: useAtomRefresh(names) };
}
