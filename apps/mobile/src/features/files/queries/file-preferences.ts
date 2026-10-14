import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { readFilePreferences } from '@porcelain/client/projects';
import type { RuntimeConnection } from '@porcelain/client/transport';

export function useFilePreferences(
  connection: RuntimeConnection,
  projectId: string,
) {
  const atom = readFilePreferences({ connection, projectId });
  return { result: useAtomValue(atom), refresh: useAtomRefresh(atom) };
}
