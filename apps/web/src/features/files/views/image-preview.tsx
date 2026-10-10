import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { assetUrl } from '@/features/files/rules/html-assets';
import type { FilesScope } from '@porcelain/client/files/rules';
import { useAsset } from '@/features/files/queries/preview-assets';
import { fileErrorMessage } from '@porcelain/client/files/rules';
import { type Connection } from '@/shared/workspace/connection';

export function ImagePreview({
  scope,
  path,
  connection,
}: {
  scope: FilesScope;
  path: string;
  connection: Connection;
}) {
  const query = useAsset(connection, scope, path);
  return (
    <div className="flex w-full flex-col items-center gap-2 p-4">
      {(() => {
        if (AsyncResult.isInitial(query)) {
          return <p role="status">Loading image…</p>;
        }
        if (AsyncResult.isFailure(query)) {
          return (
            <p role="status">{fileErrorMessage(Cause.squash(query.cause))}</p>
          );
        }
        return (
          <img
            src={assetUrl(Option.getOrThrow(AsyncResult.value(query)))}
            alt={path}
            className="max-h-[70vh] max-w-full object-contain"
          />
        );
      })()}
    </div>
  );
}
