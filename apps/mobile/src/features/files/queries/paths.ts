import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { readWorktreePaths } from '@porcelain/client/files';
import type { RuntimeConnection } from '@porcelain/client/transport';
import type { FilesScope } from '@porcelain/client/files/rules';

export function useFilePaths(connection: RuntimeConnection, scope: FilesScope) {
  const atom = readWorktreePaths({ connection, scope });
  return { result: useAtomValue(atom), refresh: useAtomRefresh(atom) };
}
