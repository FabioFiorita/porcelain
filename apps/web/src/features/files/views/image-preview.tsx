import { StateFailure, StateSpinner } from '@/shared/views/state-notice';
import { Cause, Option } from 'effect';
import { fileErrorMessage } from '@porcelain/client/files/rules';
import { AsyncResult } from 'effect/reactivity';
import { assetUrl } from '@/features/files/rules/html-assets';
import type { FilesScope } from '@porcelain/client/files/rules';
import { useAsset } from '@/features/files/queries/preview-assets';
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
      <ImageAsset query={query} path={path} />
    </div>
  );
}

function ImageAsset({
  query,
  path,
}: {
  query: ReturnType<typeof useAsset>;
  path: string;
}) {
  const { result, retry } = query;
  if (AsyncResult.isInitial(result))
    return <StateSpinner label="Reading the image" />;
  if (AsyncResult.isFailure(result))
    return (
      <StateFailure
        description={fileErrorMessage(Cause.squash(result.cause))}
        onRetry={retry}
      />
    );
  return (
    <img
      src={assetUrl(Option.getOrThrow(AsyncResult.value(result)))}
      alt={path}
      className="max-h-[70vh] max-w-full object-contain"
    />
  );
}
