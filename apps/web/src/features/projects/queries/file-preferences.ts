import { useSuspenseQuery } from '@tanstack/react-query';
import { filePreferencesQueryOptions } from '@porcelain/client/projects';
import { type Connection } from '@/shared/workspace/connection';

export function useHiddenPaths(
  connection: Connection,
  projectId: string,
): ReadonlySet<string> {
  const response = useSuspenseQuery(
    filePreferencesQueryOptions(connection, projectId),
  ).data;
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
  const response = useSuspenseQuery(
    filePreferencesQueryOptions(connection, projectId),
  ).data;
  return response.preferences
    .filter((preference) => preference.pinned)
    .map((preference) => preference.path);
}
