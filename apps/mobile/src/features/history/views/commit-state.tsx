import { ErrorState } from '../../../components/ui/error-state';
import { Spinner } from '../../../components/ui/spinner';
import type { ReactNode } from 'react';
import { AsyncResult } from 'effect/reactivity';
import type { useCommit } from '../queries/history';

export function CommitReadState({
  commit,
  children,
}: {
  commit: ReturnType<typeof useCommit>;
  children: (
    value: NonNullable<ReturnType<typeof useCommit>['value']>,
  ) => ReactNode;
}) {
  if (!commit.value)
    return (
      <CommitState
        failed={AsyncResult.isFailure(commit.result)}
        retry={commit.retry}
      />
    );
  return children(commit.value);
}

function CommitState({
  failed,
  retry,
}: {
  failed: boolean;
  retry: () => void;
}) {
  return failed ? (
    <ErrorState
      message="Couldn't load commit"
      retry={{ label: 'Retry', onPress: retry }}
    />
  ) : (
    <Spinner />
  );
}
