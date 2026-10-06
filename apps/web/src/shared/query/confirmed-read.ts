import { useAtomSuspense, useAtomValue } from '@effect/atom-react';
import { Cause, Option } from 'effect';
import { AsyncResult, type Atom } from 'effect/reactivity';

export function useConfirmedRead<A, E>(
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) {
  const current = useAtomValue(atom);
  const result = useAtomSuspense(atom, {
    includeFailure: true,
    suspendOnWaiting: Option.isNone(AsyncResult.value(current)),
  });
  const value = Option.getOrElse(AsyncResult.value(result), () => {
    if (AsyncResult.isFailure(result)) throw Cause.squash(result.cause);
    throw new Error('The read has no confirmed value');
  });
  return { result, value };
}
