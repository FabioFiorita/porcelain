import type { FilesConnection, FilesScope } from '../rules/scope';
import { useHtmlPreview } from '@/features/files/queries/preview-assets';
import { fileErrorMessage } from '../rules/error-message';
import { HtmlFrame } from './html-frame';

export function HtmlPreview({
  scope,
  path,
  html,
  connection,
}: {
  scope: FilesScope;
  path: string;
  html: string;
  connection: FilesConnection;
}) {
  const preview = useHtmlPreview(connection, scope, path, html);
  if (preview.isPending)
    return (
      <p role="status" className="p-4">
        Loading preview…
      </p>
    );
  if (preview.error)
    return (
      <p role="alert" className="p-4">
        {fileErrorMessage(preview.error)}
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
        title={`${path} HTML preview`}
        className="min-h-0 flex-1"
      />
    </>
  );
}
