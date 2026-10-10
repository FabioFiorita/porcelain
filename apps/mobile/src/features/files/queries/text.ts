import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { readTextFile } from '@porcelain/client/files';
import type { RuntimeConnection } from '@porcelain/client/transport';
import type { FilesScope } from '@porcelain/client/files/rules';
import type { ReadTextFileResponse } from '@porcelain/contracts/files';

export type FileContents = ReadTextFileResponse;

export function useTextFile(
  connection: RuntimeConnection,
  scope: FilesScope,
  path: string,
) {
  const atom = readTextFile({ connection, scope, path });
  return { result: useAtomValue(atom), refresh: useAtomRefresh(atom) };
}
