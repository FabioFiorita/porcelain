import { readProjectFolder } from '@porcelain/client/projects';
import { useAtomValue, useAtomRefresh } from '@effect/atom-react';
import type { Connection } from '@/shared/workspace/connection';

export function useProjectFolder(
  connection: Connection,
  path: string | undefined,
) {
  const folder = readProjectFolder(connection, path);
  return { value: useAtomValue(folder), refresh: useAtomRefresh(folder) };
}
