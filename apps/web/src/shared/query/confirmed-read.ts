import { useAtomSuspense, useAtomValue } from '@effect/atom-react';
import { Cause, Option } from 'effect';
import { AsyncResult, type Atom } from 'effect/reactivity';

function readValue<A, E>(result: AsyncResult.AsyncResult<A, E>) {
  const value = AsyncResult.value(result);
  if (Option.isNone(value) && AsyncResult.isFailure(result))
    throw Cause.squash(result.cause);
  return value;
}

export function usePendingRead<A, E>(
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) {
  const result = useAtomValue(atom);
  return { result, value: Option.getOrUndefined(readValue(result)) };
}

export function useConfirmedRead<A, E>(
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) {
  const current = useAtomValue(atom);
  const result = useAtomSuspense(atom, {
    includeFailure: true,
    suspendOnWaiting: Option.isNone(AsyncResult.value(current)),
  });
  const value = Option.getOrElse(readValue(result), () => {
    throw new Error('The read has no confirmed value');
  });
  return { result, value };
}
