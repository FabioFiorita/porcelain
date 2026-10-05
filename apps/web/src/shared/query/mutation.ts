import { type UseMutationResult } from '@tanstack/react-query';
import type { Effect } from 'effect';
import {
  runRequest,
  type WorktreeConnection,
} from '@porcelain/client/transport';

export function operationMutation<A, E, Input>(
  operation: (input: Input) => Effect.Effect<A, E>,
  connection: WorktreeConnection,
) {
  return {
    mutationFn: (input: Input) =>
      runRequest(operation(input), connection.request().signal),
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
