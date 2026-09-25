import { assetUrl } from '@/features/review/model/html-assets';
import type { ReviewScope } from '@/features/review/model/review';
import { useAsset } from '@/features/review/queries/preview-assets';
import { reviewErrorMessage } from '@/features/review/queries/review';

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
