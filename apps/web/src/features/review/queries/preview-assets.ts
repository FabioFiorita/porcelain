import { useQuery } from '@tanstack/react-query';
import { inlineHtmlAssets } from '@/features/review/model/html-assets';
import type { ReviewScope } from '@/features/review/model/review';
import { queryKeys } from '@/shared/query/keys';
import { useConnectedContext } from '@/app/workspace-provider';

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
      inlineHtmlAssets(html, path, async (paths) => {
        const answer = await api.review.previewAssets({
          ...scope,
          ...connection.request(signal),
          document: path,
          paths,
        });
        return new Map(
          answer.assets.map((asset) => [
            asset.path,
            asset.kind === 'asset' ? asset : null,
          ]),
        );
      }),
  });
}
