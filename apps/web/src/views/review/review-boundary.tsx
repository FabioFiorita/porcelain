import { Component, type ReactNode, Suspense } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { reviewErrorMessage, useReviewReset } from '../../query/review';

class ReviewErrorBoundary extends Component<
  { children: ReactNode; reset: () => void },
  { error: unknown }
> {
  override state = { error: null };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  override render() {
    if (this.state.error)
      return (
        <Alert className="my-3">
          <AlertDescription>
            {reviewErrorMessage(this.state.error)}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                this.props.reset();
                this.setState({ error: null });
              }}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      );
    return this.props.children;
  }
}
export function ReviewBoundary({ children }: { children: ReactNode }) {
  const { reset } = useReviewReset();
  return (
    <ReviewErrorBoundary reset={reset}>
      <Suspense
        fallback={
          <div
            role="status"
            aria-label="Loading review"
            className="flex flex-col gap-3 p-4"
          >
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <span className="sr-only">Loading review…</span>
          </div>
        }
      >
        {children}
      </Suspense>
    </ReviewErrorBoundary>
  );
}
