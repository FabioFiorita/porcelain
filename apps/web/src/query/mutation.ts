import type { UseMutationResult } from '@tanstack/react-query';

export function asMutation<TData, TError, TVariables, TContext>(
  mutation: Pick<
    UseMutationResult<TData, TError, TVariables, TContext>,
    'mutateAsync' | 'isPending' | 'isSuccess' | 'error'
  >,
) {
  return {
    submit: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
  };
}
