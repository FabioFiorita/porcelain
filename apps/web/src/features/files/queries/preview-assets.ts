import {
  readAsset,
  readPreviewAsset,
  readHtmlPreview,
  type HtmlPreviewPlatform,
} from '@porcelain/client/files';
import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import type { Layer } from 'effect';
import type { FilesScope } from '@porcelain/client/files/rules';
import { type Connection } from '@/shared/workspace/connection';
import { desktopShell } from '@/shared/shell';
import { noAsset } from '../store';

export function useAsset(
  connection: Connection,
  scope: FilesScope,
  path: string,
) {
  return useAtomValue(readAsset({ scope, connection, path }));
}
export function usePreviewAsset(
  connection: Connection | null,
  scope: FilesScope,
  document: string,
  path: string | undefined,
) {
  return useAtomValue(
    connection && path !== undefined
      ? readPreviewAsset({
          scope,
          connection,
          document,
          path,
          streamMedia: !desktopShell || connection.activeRoute === undefined,
        })
      : noAsset,
  );
}
export function useHtmlPreview(
  connection: Connection,
  scope: FilesScope,
  path: string,
  html: string,
  platform: Layer.Layer<HtmlPreviewPlatform>,
) {
  const atom = readHtmlPreview({
    scope,
    connection,
    path,
    html,
    platform,
    streamMedia: !desktopShell,
  });
  return { preview: useAtomValue(atom), refresh: useAtomRefresh(atom) };
}
