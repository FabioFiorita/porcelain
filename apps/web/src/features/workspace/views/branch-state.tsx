import { Suspense, type ReactNode } from 'react';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { branchErrorMessage } from '@porcelain/client/changes/rules';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import { useBranchChanges } from '@/features/changes/index';
import type { ConnectionContext } from '@/shared/workspace/connection';
import {
  StateFailure,
  StateNotice,
  StateSkeleton,
} from '@/shared/views/state-notice';

type Branch = AsyncResult.AsyncResult.Success<
  ReturnType<typeof useBranchChanges>['result']
>;

export function BranchState({
  scope,
  context,
  base,
  children,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  base: string | undefined;
  children: (branch: Branch) => ReactNode;
}) {
  const changes = useBranchChanges(scope, context.connection, base);
  if (AsyncResult.isFailure(changes.result))
    return (
      <StateFailure
        description={branchErrorMessage(Cause.squash(changes.result.cause))}
        onRetry={changes.refresh}
      />
    );
  if (!AsyncResult.isSuccess(changes.result))
    return <StateSkeleton label="Comparing the branch" />;
  if (changes.result.value.base === undefined)
    return (
      <StateNotice
        title="No default branch"
        description="Choose the branch this one is compared against in the Branch list."
      />
    );
  return (
    <Suspense fallback={<StateSkeleton label="Comparing the branch" />}>
      {children(changes.result.value)}
    </Suspense>
  );
}
