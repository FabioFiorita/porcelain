import { useConfirmedRead } from '@/shared/query/confirmed-read';
import { readFilePreferences } from '@porcelain/client/projects';
import { type Connection } from '@/shared/workspace/connection';

function useFilePreferences(connection: Connection, projectId: string) {
  return useConfirmedRead(readFilePreferences({ connection, projectId })).value;
}

export function useHiddenPaths(
  connection: Connection,
  projectId: string,
): ReadonlySet<string> {
  const response = useFilePreferences(connection, projectId);
  return new Set(
    response.preferences
      .filter((preference) => preference.hidden)
      .map((preference) => preference.path),
  );
}

export function usePinnedPaths(
  connection: Connection,
  projectId: string,
): readonly string[] {
  const response = useFilePreferences(connection, projectId);
  return response.preferences
    .filter((preference) => preference.pinned)
    .map((preference) => preference.path);
}
