import { assetUrl } from '../../domain/html-assets';
import type { ReviewScope } from '../../domain/review';
import { useAsset } from '../../query/preview-assets';
import { reviewErrorMessage } from '../../query/review';

export function ImagePreview({
  scope,
  path,
}: {
  scope: ReviewScope;
  path: string;
}) {
  const query = useAsset(scope, path);
  return (
    <div className="flex w-full flex-col items-center gap-2 p-4">
      {query.isPending ? (
        <p role="status">Loading image…</p>
      ) : query.error ? (
        <p role="status">{reviewErrorMessage(query.error)}</p>
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
