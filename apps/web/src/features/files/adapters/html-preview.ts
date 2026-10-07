import { Effect, Layer } from 'effect';
import {
  HtmlPreviewPlatform,
  HtmlPreviewUnavailable,
} from '@porcelain/client/files';
import { inlineHtmlAssets } from './html-assets';

export const browserHtmlPreview = Layer.succeed(HtmlPreviewPlatform, {
  render: (html, path, read) =>
    inlineHtmlAssets(html, path, read).pipe(
      Effect.catchCause(() => Effect.fail(new HtmlPreviewUnavailable())),
    ),
});
