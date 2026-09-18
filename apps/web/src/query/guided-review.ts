import { ConnectionError } from '@porcelain/client/errors/connection-error';
import { RequestError } from '@porcelain/client/errors/request-error';
import { useQuery } from '@tanstack/react-query';
import {
  type GuideSourceRead,
  guidePositionKey,
} from '../domain/guided-review';
import type { ReviewScope } from '../domain/review';
import { queryKeys } from './keys';
import { useConnectedContext } from './workspace-provider';

export function useGuidePositionKey(scope: ReviewScope, layerId: string) {
  const { connection } = useConnectedContext();
  return guidePositionKey(connection.environmentId, scope, layerId);
}

/** Only the selected source is read and polled, including unchanged context. */
export function useGuideSource(
  scope: ReviewScope,
  path: string | undefined,
  active: boolean,
): GuideSourceRead {
  const { api, connection } = useConnectedContext();
  const read = useQuery({
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'guide-source',
      path,
    ]),
    enabled: path !== undefined,
    queryFn: async ({ signal }) => {
      if (path === undefined)
        throw new ConnectionError('Choose a source to inspect.');
      const request = connection.request(signal);
      const file = await api.review.text({ ...scope, ...request, path });
      request.signal.throwIfAborted();
      if (file.worktreeId !== scope.worktreeId || file.path !== path)
        throw new ConnectionError(
          'The source context changed. Reopen this worktree to continue.',
        );
      return file;
    },
    refetchInterval: active ? 3000 : false,
    retry: false,
    throwOnError: false,
  });
  // A failed refresh must not present cached content as current evidence.
  if (read.error)
    return { kind: 'unavailable', message: sourceErrorMessage(read.error) };
  if (read.data) return { kind: 'ready', file: read.data };
  return { kind: 'loading' };
}

function sourceErrorMessage(error: unknown) {
  if (error instanceof ConnectionError) return error.message;
  if (error instanceof RequestError && error.status === 404)
    return 'This source file is missing or is no longer available.';
  if (error instanceof RequestError && error.status === 422)
    return 'This source cannot be displayed as bounded UTF-8 text.';
  return 'This source could not be refreshed. No saved code is being shown.';
}
