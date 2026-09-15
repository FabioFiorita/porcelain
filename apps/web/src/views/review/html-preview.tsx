import type { ReviewScope } from '../../domain/review';
import { useHtmlPreview } from '../../query/preview-assets';
import { reviewErrorMessage } from '../../query/review';
import { HtmlFrame } from './html-frame';

export function HtmlPreview({
  scope,
  path,
  html,
}: {
  scope: ReviewScope;
  path: string;
  html: string;
}) {
  const preview = useHtmlPreview(scope, path, html);
  if (preview.isPending)
    return (
      <p role="status" className="p-4">
        Loading preview…
      </p>
    );
  if (preview.error)
    return (
      <p role="alert" className="p-4">
        {reviewErrorMessage(preview.error)}
      </p>
    );
  return (
    <>
      {preview.data.missing.length > 0 && (
        <p role="status" className="px-4 py-2 text-xs text-muted-foreground">
          Some assets could not be loaded: {preview.data.missing.join(', ')}.
          This preview supports local static assets.
        </p>
      )}
      <HtmlFrame
        html={preview.data.html}
        title={path}
        className="min-h-0 flex-1"
      />
    </>
  );
}
