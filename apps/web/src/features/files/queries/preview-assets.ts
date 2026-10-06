import {
  readAsset,
  readHtmlPreview,
  type HtmlPreviewPlatform,
} from '@porcelain/client/files';
import { useAtomValue } from '@effect/atom-react';
import type { Layer } from 'effect';
import type { FilesScope } from '@porcelain/client/files/rules';
import { type Connection } from '@/shared/workspace/connection';

export function useAsset(
  connection: Connection,
  scope: FilesScope,
  path: string,
) {
  return useAtomValue(readAsset({ scope, connection, path }));
}
export function useHtmlPreview(
  connection: Connection,
  scope: FilesScope,
  path: string,
  html: string,
  platform: Layer.Layer<HtmlPreviewPlatform>,
) {
  return useAtomValue(
    readHtmlPreview({
      scope,
      connection,
      path,
      html,
      platform,
    }),
  );
}
