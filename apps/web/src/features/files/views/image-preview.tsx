import { assetUrl } from '@/features/files/rules/html-assets';
import type { FilesConnection, FilesScope } from '../rules/scope';
import { useAsset } from '@/features/files/queries/preview-assets';
import { fileErrorMessage } from '../rules/error-message';

export function ImagePreview({
  scope,
  path,
  connection,
}: {
  scope: FilesScope;
  path: string;
  connection: FilesConnection;
}) {
  const query = useAsset(connection, scope, path);
  return (
    <div className="flex w-full flex-col items-center gap-2 p-4">
      {query.isPending ? (
        <p role="status">Loading image…</p>
      ) : query.error ? (
        <p role="status">{fileErrorMessage(query.error)}</p>
      ) : (
        <img
          src={assetUrl(query.data)}
          alt={path}
          className="max-h-[70vh] max-w-full object-contain"
        />
      )}
    </div>
  );
}
