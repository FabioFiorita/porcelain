import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { branchErrorMessage } from '@porcelain/client/changes/rules';
import type { useBranchChanges } from '@/features/changes/index';
import {
  StateFailure,
  StateNotice,
  StateSkeleton,
} from '@/components/state-notice';

export function BranchState({
  changes,
}: {
  changes: ReturnType<typeof useBranchChanges>;
}) {
  if (AsyncResult.isFailure(changes.result))
    return (
      <StateFailure
        description={branchErrorMessage(Cause.squash(changes.result.cause))}
        onRetry={changes.refresh}
      />
    );
  if (!AsyncResult.isSuccess(changes.result))
    return <StateSkeleton label="Comparing the branch" />;
  return (
    <StateNotice
      title="No default branch"
      description="Choose the branch this one is compared against in the Branch list."
    />
  );
}
