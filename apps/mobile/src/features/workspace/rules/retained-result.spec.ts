import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { expect, test } from 'vite-plus/test';
import { retainedResult } from './retained-result';

test('a re-paired connection keeps the last snapshot visible until its own answer arrives', () => {
  const kept = retainedResult(AsyncResult.initial<string>(true), {
    value: 'last snapshot',
  });
  expect(Option.getOrUndefined(AsyncResult.value(kept))).toBe('last snapshot');
  expect(kept.waiting).toBe(true);
  const fresh = retainedResult(AsyncResult.success('new snapshot'), {
    value: 'last snapshot',
  });
  expect(Option.getOrUndefined(AsyncResult.value(fresh))).toBe('new snapshot');
});

test('a first read with nothing to keep still waits for its answer', () => {
  const first = retainedResult(AsyncResult.initial<string>(true), undefined);
  expect(AsyncResult.isInitial(first)).toBe(true);
});
