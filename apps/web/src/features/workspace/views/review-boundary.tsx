import { Component, type ReactNode, Suspense } from 'react';
import {
  StateFailure,
  StateNotice,
  StateSpinner,
} from '@/shared/views/state-notice';
import { reviewErrorMessage } from '@porcelain/client/changes/rules';
import { useRetryReview } from '../commands/read-retry';
import type { Connection } from '@/shared/workspace/connection';
import type { ReviewScope } from '@porcelain/client/changes/rules';

class ReviewErrorBoundary extends Component<
  { children: ReactNode; reset: (show: () => void) => void },
  { error: unknown }
> {
  override state = { error: null };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  override render() {
    const error: unknown = this.state.error;
    if (error instanceof Error && error.name === 'CommitNotFoundError')
      return <StateNotice message="This commit is not in this repository." />;
    if (error)
      return (
        <StateFailure
          description={reviewErrorMessage(error)}
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
  quiet = false,
  documentKey,
}: {
  children: ReactNode;
  connection: Connection;
  scope: ReviewScope;
  quiet?: boolean;
  documentKey?: string | undefined;
}) {
  const reset = useRetryReview(connection, scope);
  return (
    <Suspense fallback={quiet ? null : <StateSpinner label="Loading review" />}>
      <ReviewErrorBoundary key={documentKey} reset={reset}>
        {children}
      </ReviewErrorBoundary>
    </Suspense>
  );
}
