import { NodeFileSystem } from '@effect/platform-node';
import { readdir } from 'node:fs/promises';
import { expect, it } from '@effect/vitest';
import { Effect, FileSystem } from 'effect';
import { TestClock } from 'effect/testing';
import { openWindowState } from './window-state.ts';

const first = {
  bounds: { x: 0, y: 0, width: 900, height: 700 },
  maximized: false,
};
const second = {
  bounds: { x: 40, y: 30, width: 1000, height: 760 },
  maximized: false,
};
const third = { ...second, maximized: true };

const fixture = Effect.gen(function* () {
  const profile = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped(
    {
      prefix: 'porcelain-desktop-persistence-',
    },
  );
  const state = yield* openWindowState(profile, 50);
  return { profile, state };
});

it.effect('restores nothing for a fresh profile', () =>
  Effect.gen(function* () {
    const { state } = yield* fixture;
    expect(yield* state.read()).toBeUndefined();
    yield* state.schedule(first);
    yield* state.flush();
    expect(yield* state.read()).toEqual({
      bounds: { x: 0, y: 0, width: 900, height: 700 },
      maximized: false,
    });
  }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
);

it.effect('debounces movement and persists only the latest state', () =>
  Effect.gen(function* () {
    const { state, profile } = yield* fixture;
    yield* state.schedule(first);
    yield* TestClock.adjust(40);
    yield* state.schedule(second);
    yield* TestClock.adjust(40);
    expect(yield* Effect.tryPromise(() => readdir(profile))).toEqual([]);
    yield* TestClock.adjust(10);
    const saved = yield* state
      .read()
      .pipe(Effect.repeat({ until: (value) => value !== undefined }));
    expect(saved).toEqual({
      bounds: { x: 40, y: 30, width: 1000, height: 760 },
      maximized: false,
    });
    expect(yield* Effect.tryPromise(() => readdir(profile))).toEqual([
      'window.json',
    ]);
  }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
);

it.effect('flush saves the pending state immediately', () =>
  Effect.gen(function* () {
    const { state, profile } = yield* fixture;
    yield* state.schedule(first);
    yield* state.flush();
    const reopened = yield* openWindowState(profile, 10);
    expect(yield* reopened.read()).toEqual({
      bounds: { x: 0, y: 0, width: 900, height: 700 },
      maximized: false,
    });
  }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
);

it.effect('keeps the latest state while an earlier save is being written', () =>
  Effect.gen(function* () {
    const { state } = yield* fixture;
    yield* state.schedule(first);
    yield* Effect.all(
      [
        state.flush(),
        Effect.gen(function* () {
          yield* state.schedule(second);
          yield* state.schedule(third);
          yield* state.flush();
        }),
      ],
      { concurrency: 'unbounded' },
    );
    expect(yield* state.read()).toEqual(third);
  }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
);

it.effect('scope closure saves queued state without waiting for debounce', () =>
  Effect.gen(function* () {
    const { profile } = yield* fixture;
    yield* Effect.gen(function* () {
      const state = yield* openWindowState(profile, 60_000);
      yield* state.schedule(third);
    }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer));
    const reopened = yield* openWindowState(profile, 10);
    expect(yield* reopened.read()).toEqual(third);
  }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
);
