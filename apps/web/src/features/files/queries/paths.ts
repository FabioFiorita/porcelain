import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { readWorktreePaths } from '@porcelain/client/files';
import type { FilesScope } from '@porcelain/client/files/rules';
import { type Connection } from '@/shared/workspace/connection';

export function useWorktreePaths(connection: Connection, scope: FilesScope) {
  const names = readWorktreePaths({ connection, scope });
  return { result: useAtomValue(names), refresh: useAtomRefresh(names) };
}
