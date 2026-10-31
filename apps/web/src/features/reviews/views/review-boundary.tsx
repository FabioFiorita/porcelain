import { Component, type ReactNode, Suspense } from 'react';
import { StateFailure, StateSkeleton } from '@/shared/views/state-notice';
import { reviewErrorMessage } from '@porcelain/client/reviews/rules';
import { useRetryReview } from '../commands/read-retry';
import type { Connection } from '@/shared/workspace/connection';
import type { ReviewScope } from '@porcelain/client/reviews/rules';

class ReviewErrorBoundary extends Component<
  { children: ReactNode; reset: (show: () => void) => void },
  { error: unknown }
> {
  override state = { error: null };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  override render() {
    if (this.state.error)
      return (
        <StateFailure
          description={reviewErrorMessage(this.state.error)}
          onRetry={() => this.props.reset(() => this.setState({ error: null }))}
        />
      );
    return this.props.children;
  }
}
export function ReviewBoundary({
  children,
  connection,
  scope,
  loadingLabel = 'Loading review',
}: {
  children: ReactNode;
  connection: Connection;
  scope: ReviewScope;
  loadingLabel?: string;
}) {
  const reset = useRetryReview(connection, scope);
  return (
    <ReviewErrorBoundary reset={reset}>
      <Suspense fallback={<StateSkeleton label={loadingLabel} />}>
        {children}
      </Suspense>
    </ReviewErrorBoundary>
  );
}
