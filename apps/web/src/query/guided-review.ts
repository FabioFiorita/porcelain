import { ConnectionError } from '@porcelain/client/errors/connection-error';
import { RequestError } from '@porcelain/client/errors/request-error';
import { useQueries } from '@tanstack/react-query';
import {
  type GuideSourceRead,
  guidePositionKey,
  guideSources,
  type ReviewGuide,
} from '../domain/guided-review';
import type { ReviewScope } from '../domain/review';
import { queryKeys } from './keys';
import { useConnectedContext } from './workspace-provider';

export function useGuideSources(
  scope: ReviewScope,
  layerId: string,
  guide: ReviewGuide,
  active: boolean,
) {
  const { api, connection } = useConnectedContext();
  const paths = [...new Set(guideSources(guide).map((source) => source.path))];
  const reads = useQueries({
    queries: paths.map((path) => ({
      queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
        'guide-source',
        path,
      ]),
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
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
    })),
  });
  const sources = new Map<string, GuideSourceRead>();
  for (const [index, path] of paths.entries()) {
    const read = reads[index];
    // A failed refresh must not present its cached content as current evidence.
    if (read?.error) {
      sources.set(path, {
        kind: 'unavailable',
        message: sourceErrorMessage(read.error),
      });
    } else if (read?.data) {
      sources.set(path, { kind: 'ready', file: read.data });
    } else {
      sources.set(path, { kind: 'loading' });
    }
  }
  return {
    sources,
    positionKey: guidePositionKey(connection.environmentId, scope, layerId),
  };
}

function sourceErrorMessage(error: unknown) {
  if (error instanceof ConnectionError) return error.message;
  if (error instanceof RequestError && error.status === 404)
    return 'This source file is missing or is no longer available.';
  if (error instanceof RequestError && error.status === 422)
    return 'This source cannot be displayed as bounded UTF-8 text.';
  return 'This source could not be refreshed. No saved code is being shown.';
}
