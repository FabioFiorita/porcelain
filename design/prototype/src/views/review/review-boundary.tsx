import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import { Component, type ReactNode, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { reviewErrorMessage } from '../../query/review';

class Boundary extends Component<
  { onReset: () => void; children: ReactNode },
  { error: unknown }
> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    if (this.state.error == null) return this.props.children;
    return (
      <div className="grid h-full min-h-40 place-items-center p-6 text-center">
        <div className="flex max-w-xs flex-col items-center gap-2">
          <TriangleAlert className="size-5 text-muted-foreground" />
          <p className="text-sm">{reviewErrorMessage(this.state.error)}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              this.props.onReset();
              this.setState({ error: null });
            }}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }
}

export function ReviewPending({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2 p-3">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows, never reordered
          key={index}
          className="h-5"
          style={{ width: `${90 - ((index * 13) % 40)}%` }}
        />
      ))}
    </div>
  );
}

/** Loading and failure for one region, so a broken panel never blanks the workspace. */
export function ReviewBoundary({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <Boundary onReset={reset}>
          <Suspense fallback={fallback ?? <ReviewPending />}>
            {children}
          </Suspense>
        </Boundary>
      )}
    </QueryErrorResetBoundary>
  );
}
