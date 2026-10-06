import { useAtomSuspense } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { Cause, Option } from 'effect';
import { readFilePreferences } from '@porcelain/client/projects';
import { type Connection } from '@/shared/workspace/connection';

function useFilePreferences(connection: Connection, projectId: string) {
  const result = useAtomSuspense(
    readFilePreferences({ connection, projectId }),
    { includeFailure: true },
  );
  if (AsyncResult.isSuccess(result)) return result.value;
  return Option.getOrElse(AsyncResult.value(result), () => {
    throw Cause.squash(result.cause);
  });
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
