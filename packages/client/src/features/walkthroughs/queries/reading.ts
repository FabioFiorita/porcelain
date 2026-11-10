import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { Reading } from '../rules/opening.ts';

export function readingOf<A, B>(
  result: AsyncResult.AsyncResult<A, unknown>,
  value: (read: A) => B,
): Reading<B> {
  const read = Option.getOrUndefined(AsyncResult.value(result));
  if (read !== undefined) return { status: 'read', value: value(read) };
  return AsyncResult.isFailure(result)
    ? { status: 'failed' }
    : { status: 'reading' };
}
