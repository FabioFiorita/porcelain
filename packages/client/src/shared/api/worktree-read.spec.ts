import { expect, it } from 'vitest';
import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { idleClientAtoms } from '../../../spec/kit/client-fixture.ts';
import { retainedReadFixture } from '../../../spec/kit/retained-read.ts';
import { createAtomClock } from '../../../spec/kit/atom-clock.ts';

it('retains a returning answer through failure and explicit retry without masking the failure', async () => {
  const subject = retainedReadFixture();
  const { registry, read } = subject;
  let stop = registry.mount(read);
  try {
    expect(AsyncResult.value(registry.get(read))).toEqual(
      Option.some('confirmed'),
    );
    stop();
    await idleClientAtoms(registry);
    subject.answer(AsyncResult.initial(true));
    stop = registry.mount(read);
    expect(registry.get(read)).toMatchObject({
      _tag: 'Success',
      waiting: true,
      value: 'confirmed',
    });
    subject.answer(AsyncResult.fail('Unavailable'));
    registry.refresh(read);
    const failure = registry.get(read);
    expect(failure._tag).toBe('Failure');
    expect(AsyncResult.value(failure)).toEqual(Option.some('confirmed'));
    if (AsyncResult.isFailure(failure))
      expect(Cause.squash(failure.cause)).toBe('Unavailable');
    subject.answer(AsyncResult.success('fresh'));
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
  const clock = createAtomClock();
  const subject = retainedReadFixture(clock.registry);
  const { registry, read } = subject;
  let stop = registry.mount(read);
  try {
    expect(AsyncResult.value(registry.get(read))).toEqual(
      Option.some('confirmed'),
    );
    await clock.advance(301_000);
    stop();
    await clock.advance(0);
    subject.answer(AsyncResult.initial(true));
    stop = registry.mount(read);
    expect(AsyncResult.value(registry.get(read))).toEqual(
      Option.some('confirmed'),
    );
    stop();
    await clock.advance(0);
    await clock.advance(301_000);
    stop = registry.mount(read);
    expect(registry.get(read)).toMatchObject({
      _tag: 'Initial',
      waiting: true,
    });
    expect(AsyncResult.value(registry.get(read))).toEqual(Option.none());
  } finally {
    stop();
    clock.dispose();
  }
});
