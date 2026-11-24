import { AsyncResult } from 'effect/reactivity';

export function retainedResult<A, E>(
  result: AsyncResult.AsyncResult<A, E>,
  previous: { readonly value: A } | undefined,
): AsyncResult.AsyncResult<A, E> {
  return AsyncResult.isInitial(result) && previous
    ? AsyncResult.success(previous.value, { waiting: true })
    : result;
}
