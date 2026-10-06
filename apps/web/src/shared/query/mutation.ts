import type { WriteQueues } from '@porcelain/client/transport';
import type { Reactivity } from 'effect/reactivity';
import { type UseMutationResult } from '@tanstack/react-query';
import type { Effect } from 'effect';
import {
  runClientRequest,
  type RuntimeConnection,
} from '@porcelain/client/transport';

export function operationMutation<A, E, Input>(
  operation: (
    input: Input,
  ) => Effect.Effect<A, E, WriteQueues | Reactivity.Reactivity>,
  connection: RuntimeConnection,
) {
  return {
    mutationFn: (input: Input) =>
      runClientRequest(
        operation(input),
        connection.request().signal,
        connection.runtime,
      ),
  };
}

export function asMutation<TData, TError, TVariables, TContext>(
  mutation: Pick<
    UseMutationResult<TData, TError, TVariables, TContext>,
    'mutateAsync' | 'isPending' | 'isSuccess' | 'error' | 'reset'
  >,
) {
  return {
    submit: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    reset: mutation.reset,
  };
}
