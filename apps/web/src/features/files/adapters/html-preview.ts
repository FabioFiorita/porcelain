import { Effect, Layer } from 'effect';
import {
  HtmlPreviewPlatform,
  HtmlPreviewUnavailable,
} from '@porcelain/client/files';
import { inlineHtmlAssets } from '../rules/html-assets';

export const browserHtmlPreview = Layer.succeed(HtmlPreviewPlatform, {
  render: (html, path, read) =>
    Effect.tryPromise({
      try: (signal) =>
        inlineHtmlAssets(html, path, (paths) =>
          Effect.runPromise(read(paths), { signal }),
        ),
      catch: () => new HtmlPreviewUnavailable(),
    }),
});
