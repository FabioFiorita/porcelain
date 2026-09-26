import { queryOptions, useQuery } from '@tanstack/react-query';
import { inlineHtmlAssets } from '../rules/html-assets';
import { filesApi } from '../api';
import type { FilesConnection, FilesScope } from '../rules/scope';

function assetQueryOptions(
  environmentId: string,
  scope: FilesScope,
  path: string,
  request: (signal?: AbortSignal) => { signal: AbortSignal },
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
      const connected = request(signal);
      const result = await filesApi.asset(
        connected.signal,
        scope.worktreeId,
        path,
      );
      connected.signal.throwIfAborted();
      return result;
    },
  });
}

export function useAsset(
  connection: FilesConnection | null,
  scope: FilesScope,
  path: string,
) {
  if (!connection) throw new Error('A connected environment is required');
  return useQuery(
    assetQueryOptions(
      connection.environmentId,
      scope,
      path,
      connection.request,
    ),
  );
}

function htmlPreviewQueryOptions(
  environmentId: string,
  scope: FilesScope,
  path: string,
  html: string,
  request: (signal?: AbortSignal) => { signal: AbortSignal },
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
      const connected = request(signal);
      const result = await inlineHtmlAssets(html, path, async (paths) => {
        const response = await filesApi.previewAssets(
          connected.signal,
          scope.worktreeId,
          path,
          paths,
        );
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
  connection: FilesConnection | null,
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
      connection.request,
    ),
  );
}
