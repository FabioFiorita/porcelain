import { queryOptions, useQuery } from '@tanstack/react-query';
import { inlineHtmlAssets } from '../rules/html-assets';
import { filesApi } from '../api';
import type { FilesScope } from '../rules/scope';
import { type Connection } from '@/shared/workspace/connection';

function assetQueryOptions(
  environmentId: string,
  scope: FilesScope,
  path: string,
  connection: Connection,
) {
  return queryOptions({
    queryKey: [
      'review',
      environmentId,
      scope.projectId,
      scope.worktreeId,
      'asset',
      path,
    ],
    queryFn: async ({ signal }) => {
      const connected = connection.request(signal);
      const result = await filesApi(connection).asset({
        signal: connected.signal,
        worktreeId: scope.worktreeId,
        path,
      });
      connected.signal.throwIfAborted();
      return result;
    },
  });
}

export function useAsset(
  connection: Connection | null,
  scope: FilesScope,
  path: string,
) {
  if (!connection) throw new Error('A connected environment is required');
  return useQuery(
    assetQueryOptions(connection.environmentId, scope, path, connection),
  );
}

function htmlPreviewQueryOptions(
  environmentId: string,
  scope: FilesScope,
  path: string,
  html: string,
  connection: Connection,
) {
  return queryOptions({
    queryKey: [
      'review',
      environmentId,
      scope.projectId,
      scope.worktreeId,
      'html-preview',
      path,
      html,
    ],
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
      connected.signal.throwIfAborted();
      return result;
    },
  });
}

export function useHtmlPreview(
  connection: Connection | null,
  scope: FilesScope,
  path: string,
  html: string,
) {
  if (!connection) throw new Error('A connected environment is required');
  return useQuery(
    htmlPreviewQueryOptions(
      connection.environmentId,
      scope,
      path,
      html,
      connection,
    ),
  );
}
