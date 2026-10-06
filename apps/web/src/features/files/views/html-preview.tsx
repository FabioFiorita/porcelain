import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { FilesScope } from '@porcelain/client/files/rules';
import { useHtmlPreview } from '@/features/files/queries/preview-assets';
import { browserHtmlPreview } from '../adapters/html-preview';
import { fileErrorMessage } from '@porcelain/client/files/rules';
import { HtmlFrame } from './html-frame';
import { type Connection } from '@/shared/workspace/connection';

export function HtmlPreview({
  scope,
  path,
  html,
  connection,
}: {
  scope: FilesScope;
  path: string;
  html: string;
  connection: Connection;
}) {
  const preview = useHtmlPreview(
    connection,
    scope,
    path,
    html,
    browserHtmlPreview,
  );
  if (AsyncResult.isInitial(preview))
    return (
      <p role="status" className="p-4">
        Loading preview…
      </p>
    );
  if (AsyncResult.isFailure(preview))
    return (
      <p role="alert" className="p-4">
        {fileErrorMessage(Cause.squash(preview.cause))}
      </p>
    );
  const document = Option.getOrThrow(AsyncResult.value(preview));
  return (
    <>
      {document.missing.length > 0 && (
        <p role="status" className="px-4 py-2 text-xs text-muted-foreground">
          Some assets could not be loaded: {document.missing.join(', ')}. This
          preview supports local static assets.
        </p>
      )}
      <HtmlFrame
        html={document.html}
        title={`${path} HTML preview`}
        className="min-h-0 flex-1"
      />
    </>
  );
}
