import { queryKeys, assertCurrentAnswer } from '@porcelain/client/transport';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { inlineHtmlAssets } from '../rules/html-assets';
import { filesApi } from '../api';
import type { FilesScope } from '../rules/scope';
import { type Connection } from '@/shared/workspace/connection';

function assetQueryOptions(
  scope: FilesScope,
  path: string,
  connection: Connection,
) {
  return queryOptions({
    queryKey: queryKeys.worktreeSurface(connection, scope, ['asset', path]),
    queryFn: async ({ signal }) => {
      const connected = connection.request(signal);
      const result = await filesApi(connection).asset({
        signal: connected.signal,
        worktreeId: scope.worktreeId,
        path,
      });
      assertCurrentAnswer(connected.signal);
      return result;
    },
  });
}

export function useAsset(
  connection: Connection,
  scope: FilesScope,
  path: string,
) {
  return useQuery(assetQueryOptions(scope, path, connection));
}

function htmlPreviewQueryOptions(
  scope: FilesScope,
  path: string,
  html: string,
  connection: Connection,
) {
  return queryOptions({
    queryKey: queryKeys.worktreeSurface(connection, scope, [
      'html-preview',
      path,
      html,
    ]),
    queryFn: async ({ signal }) => {
      const connected = connection.request(signal);
      const result = await inlineHtmlAssets(html, path, async (paths) => {
        const response = await filesApi(connection).previewAssets({
          signal: connected.signal,
          worktreeId: scope.worktreeId,
          document: path,
          paths,
        });
        return new Map(
          response.assets.map((asset) => [
            asset.path,
            asset.kind === 'asset' ? asset : null,
          ]),
        );
      });
      assertCurrentAnswer(connected.signal);
      return result;
    },
  });
}

export function useHtmlPreview(
  connection: Connection,
  scope: FilesScope,
  path: string,
  html: string,
) {
  return useQuery(htmlPreviewQueryOptions(scope, path, html, connection));
}
