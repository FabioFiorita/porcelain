import { expect, it, vi } from 'vitest';
import { Cause, Option } from 'effect';
import { Atom, AtomRegistry, AsyncResult } from 'effect/reactivity';
import { idleClientAtoms } from '../../../spec/kit/client-fixture.ts';
import { retainRead } from './worktree-read.ts';

it('retains a returning answer through failure and explicit retry without masking the failure', async () => {
  const registry = AtomRegistry.make();
  let answer: AsyncResult.AsyncResult<string, string> =
    AsyncResult.success('confirmed');
  const source = Atom.make(() => answer).pipe(Atom.setIdleTTL(0));
  const read = retainRead(source);
  let stop = registry.mount(read);
  try {
    expect(AsyncResult.value(registry.get(read))).toEqual(
      Option.some('confirmed'),
    );
    stop();
    await idleClientAtoms(registry);
    answer = AsyncResult.initial(true);
    stop = registry.mount(read);
    expect(registry.get(read)).toMatchObject({
      _tag: 'Success',
      waiting: true,
      value: 'confirmed',
    });
    answer = AsyncResult.fail('Unavailable');
    registry.refresh(read);
    const failure = registry.get(read);
    expect(failure._tag).toBe('Failure');
    expect(AsyncResult.value(failure)).toEqual(Option.some('confirmed'));
    if (AsyncResult.isFailure(failure))
      expect(Cause.squash(failure.cause)).toBe('Unavailable');
    answer = AsyncResult.success('fresh');
    registry.refresh(read);
    expect(registry.get(read)).toMatchObject({
      _tag: 'Success',
      waiting: false,
      value: 'fresh',
    });
  } finally {
    stop();
    registry.dispose();
  }
});

it('expires an idle retained answer after five minutes while keeping an active answer', async () => {
  vi.useFakeTimers();
  const registry = AtomRegistry.make({
    scheduleTask: (task) => {
      const timer = setTimeout(task, 0);
      return () => clearTimeout(timer);
    },
  });
  let answer: AsyncResult.AsyncResult<string> =
    AsyncResult.success('confirmed');
  const source = Atom.make(() => answer).pipe(Atom.setIdleTTL(0));
  const read = retainRead(source);
  let stop = registry.mount(read);
  try {
    expect(AsyncResult.value(registry.get(read))).toEqual(
      Option.some('confirmed'),
    );
    await vi.advanceTimersByTimeAsync(301_000);
    stop();
    await vi.advanceTimersByTimeAsync(0);
    answer = AsyncResult.initial(true);
    stop = registry.mount(read);
    expect(AsyncResult.value(registry.get(read))).toEqual(
      Option.some('confirmed'),
    );
    stop();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(301_000);
    stop = registry.mount(read);
    expect(registry.get(read)).toMatchObject({
      _tag: 'Initial',
      waiting: true,
    });
    expect(AsyncResult.value(registry.get(read))).toEqual(Option.none());
  } finally {
    stop();
    registry.dispose();
    vi.useRealTimers();
  }
});
