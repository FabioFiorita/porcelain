import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { readAsset } from '@porcelain/client/files';
import type { RuntimeConnection } from '@porcelain/client/transport';
import type { FilesScope } from '@porcelain/client/files/rules';

export function useFileAsset(
  connection: RuntimeConnection,
  scope: FilesScope,
  path: string,
) {
  const atom = readAsset({ connection, scope, path });
  return { result: useAtomValue(atom), refresh: useAtomRefresh(atom) };
}
