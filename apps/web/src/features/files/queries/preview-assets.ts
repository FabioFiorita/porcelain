import { assetQueryOptions, readPreviewAssets } from '@porcelain/client/files';
import {
  queryKeys,
  assertCurrentAnswer,
  runRequest,
} from '@porcelain/client/transport';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { inlineHtmlAssets } from '../rules/html-assets';
import type { FilesScope } from '@porcelain/client/files/rules';
import { type Connection } from '@/shared/workspace/connection';

export function useAsset(
  connection: Connection,
  scope: FilesScope,
  path: string,
) {
  return useQuery(assetQueryOptions(scope, connection, path));
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
      const result = await inlineHtmlAssets(html, path, (paths) =>
        runRequest(
          readPreviewAssets(connection, scope, path, paths),
          connected.signal,
        ),
      );
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
