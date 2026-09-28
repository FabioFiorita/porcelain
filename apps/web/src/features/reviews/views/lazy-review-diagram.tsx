import { type ComponentProps, lazy, Suspense } from 'react';

const LoadedReviewDiagram = lazy(() => import('./review-diagram'));

export function ReviewDiagram(
  props: ComponentProps<typeof LoadedReviewDiagram>,
) {
  return (
    <Suspense
      fallback={
        <p role="status" className="flex-1 p-4 text-sm text-muted-foreground">
          Loading diagram…
        </p>
      }
    >
      <LoadedReviewDiagram {...props} />
    </Suspense>
  );
}
