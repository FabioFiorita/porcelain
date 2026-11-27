import type { ReactNode } from 'react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  githubUnavailable,
  type PullRequestRead,
} from '@porcelain/client/projects/rules';
import { ErrorState } from '../../../components/ui/error-state';
import { Spinner } from '../../../components/ui/spinner';
import {
  usePullRequestRead,
  type PullRequestRef,
} from '../queries/pull-request';

export type AvailablePullRequest = Extract<
  PullRequestRead,
  { kind: 'available' }
>['pullRequest'];

export function PullRequestReadState({
  target,
  children,
}: {
  target: PullRequestRef;
  children: (pull: AvailablePullRequest) => ReactNode;
}) {
  const { result, refresh } = usePullRequestRead(target);
  const value = Option.getOrUndefined(AsyncResult.value(result));
  if (!value && !AsyncResult.isFailure(result)) return <Spinner />;
  if (value?.kind === 'available') return children(value.pullRequest);
  return (
    <ErrorState
      message={
        value
          ? githubUnavailable(value.reason).description
          : 'The pull request could not be read.'
      }
      retry={{
        label: 'Read pull request again',
        onPress: refresh,
        pending: result.waiting,
      }}
    />
  );
}
