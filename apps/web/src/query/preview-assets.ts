import { useQuery } from '@tanstack/react-query';
import { inlineHtmlAssets } from '../domain/html-assets';
import type { ReviewScope } from '../domain/review';
import { queryKeys } from './keys';
import { useConnectedContext } from './workspace-provider';

export function useAsset(scope: ReviewScope, path: string) {
  const { api, connection } = useConnectedContext();
  return useQuery({
    queryKey: [
      ...queryKeys.review(connection.environmentId, scope),
      'asset',
      path,
    ],
    queryFn: ({ signal }) =>
      api.review.asset({ ...scope, ...connection.request(signal), path }),
  });
}
export function useHtmlPreview(scope: ReviewScope, path: string, html: string) {
  const { api, connection } = useConnectedContext();
  return useQuery({
    queryKey: [
      ...queryKeys.review(connection.environmentId, scope),
      'html-preview',
      path,
      html,
    ],
    queryFn: ({ signal }) =>
      inlineHtmlAssets(html, path, (path) =>
        api.review.asset({ ...scope, ...connection.request(signal), path }),
      ),
  });
}
