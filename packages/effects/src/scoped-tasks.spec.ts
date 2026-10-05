import { expect, it } from '@effect/vitest';
import { Effect } from 'effect';
import { TestClock } from 'effect/testing';
import { ScopedTasks } from './scoped-tasks.ts';

it.effect('a retained feature runs its timer once at the deadline', () =>
  Effect.gen(function* () {
    const tasks = new ScopedTasks(yield* Effect.context());
    yield* Effect.addFinalizer(() => tasks.close());
    let runs = 0;
    tasks.after(3000, () => {
      runs += 1;
    });
    yield* TestClock.adjust(2999);
    expect(runs).toBe(0);
    yield* TestClock.adjust(1);
    expect(runs).toBe(1);
    yield* TestClock.adjust(3000);
    expect(runs).toBe(1);
  }),
);

it.effect('cancellation and disposal remove scheduled work', () =>
  Effect.gen(function* () {
    const tasks = new ScopedTasks(yield* Effect.context());
    let runs = 0;
    const cancel = tasks.after(1000, () => {
      runs += 1;
    });
    cancel();
    yield* TestClock.adjust(1000);
    expect(runs).toBe(0);
    tasks.after(1000, () => {
      runs += 1;
    });
    yield* tasks.close();
    yield* TestClock.adjust(1000);
    expect(runs).toBe(0);
  }),
);
