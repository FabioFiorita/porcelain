import type { UseMutationResult } from '@tanstack/react-query';

export type Mutation<TInput, TOutput = unknown> = {
  submit: (input: TInput) => Promise<TOutput>;
  isPending: boolean;
  isSuccess: boolean;
  error: Error | null;
  reset: () => void;
};

/** The one mutation shape views see. Mirrors apps/web/src/query/mutation.ts. */
export function asMutation<TOutput, TInput>(
  mutation: UseMutationResult<TOutput, Error, TInput>,
): Mutation<TInput, TOutput> {
  return {
    submit: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/** Views fire a mutation and read its state from the hook; the rejection is already rendered. */
export function discardRejection(promise: Promise<unknown>): void {
  promise.catch(() => undefined);
}
