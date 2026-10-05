import { Deferred, Duration, Effect, Fiber } from 'effect';
import { TestClock } from 'effect/testing';
import { nativeOperation } from '@porcelain/effects';
import { ContentChangedError } from '@porcelain/files/errors';
import { describe, expect } from 'vitest';
import { it } from '@effect/vitest';
import { ConnectionError } from '@porcelain/client/transport';
import {
  FileDrafts,
  FileDraftTiming,
  fileDraftRuntime,
  type FileDraftWriteFailure,
} from '@porcelain/client/files';

function fixture(
  text: string,
  fingerprint: string,
  write: (
    text: string,
    fingerprint: string,
  ) => Effect.Effect<string, FileDraftWriteFailure>,
  isBlockedError?: (error: unknown) => boolean,
) {
  return Effect.runSync(
    fileDraftRuntime.runSync(FileDrafts).retain({
      environmentId: 'portable-draft',
      scope: { projectId: 'project', worktreeId: 'tree' },
      path: 'file.txt',
      text,
      fingerprint,
      writer: {
        write: (input) => write(input.text, input.expectedFingerprint),
        ...(isBlockedError ? { isBlockedError } : {}),
      },
    }),
  );
}

describe('portable file draft', () => {
  it('saves changes made during a write against the newly confirmed fingerprint', async () => {
    const firstWrite = Promise.withResolvers<string>();
    const writes: { text: string; fingerprint: string }[] = [];
    const draft = fixture(
      'original',
      'version-1',
      (text, fingerprint) => {
        writes.push({ text, fingerprint });
        return nativeOperation(() =>
          writes.length === 1
            ? firstWrite.promise
            : Promise.resolve('version-3'),
        );
      },
      () => false,
    );
    try {
      await Effect.runPromise(draft.change('first edit'));
      const saving = Effect.runPromise(draft.save());
      const following = Effect.runPromise(draft.save());
      await Effect.runPromise(draft.change('second edit'));
      firstWrite.resolve('version-2');
      expect(await saving).toBe(true);
      expect(await following).toBe(true);
      expect(writes).toEqual([
        { text: 'first edit', fingerprint: 'version-1' },
        { text: 'second edit', fingerprint: 'version-2' },
      ]);
      expect(draft.state.value).toMatchObject({
        text: 'second edit',
        savedText: 'second edit',
        fingerprint: 'version-3',
        saving: false,
        error: null,
      });
    } finally {
      await Effect.runPromise(draft.dispose());
    }
  });

  it('retains a conflicting draft and refuses another write until explicit reset', async () => {
    const conflict = new ContentChangedError();
    let writes = 0;
    const draft = fixture('original', 'version-1', () => {
      writes += 1;
      return Effect.fail(conflict);
    });
    try {
      await Effect.runPromise(draft.change('unsaved'));
      expect(await Effect.runPromise(draft.save())).toBe(false);
      expect(draft.blocked).toBe(true);
      expect(await Effect.runPromise(draft.save())).toBe(false);
      expect(writes).toBe(1);
      expect(draft.state.value).toMatchObject({
        text: 'unsaved',
        savedText: 'original',
        fingerprint: 'version-1',
        error: conflict,
      });
      await Effect.runPromise(draft.reset('disk version', 'version-2'));
      expect(draft.blocked).toBe(false);
      expect(draft.state.value).toMatchObject({
        text: 'disk version',
        savedText: 'disk version',
        fingerprint: 'version-2',
        error: null,
      });
    } finally {
      await Effect.runPromise(draft.dispose());
    }
  });

  it('admits only one editor owner and ignores another owner releasing it', async () => {
    const draft = fixture(
      'text',
      'version',
      () => Effect.succeed('saved'),
      () => false,
    );
    try {
      expect(draft.claim('web')).toBe(true);
      expect(draft.claim('mobile')).toBe(false);
      draft.release('mobile');
      expect(draft.state.value.owner).toBe('web');
      draft.release('web');
      expect(draft.claim('mobile')).toBe(true);
    } finally {
      await Effect.runPromise(draft.dispose());
    }
  });

  it('keeps ownership and avoids saving when an editor reattaches during cleanup', async () => {
    let writes = 0;
    let notifications = 0;
    let detachments = 0;
    const draft = fixture(
      'text',
      'version',
      () => {
        writes += 1;
        return Effect.succeed('saved');
      },
      () => false,
    );
    try {
      draft.claim('editor');
      await Effect.runPromise(draft.change('draft'));
      draft.attachEditor('editor');
      const cleanup = Effect.runPromise(
        draft.finishEditing(
          'editor',
          () => {
            notifications += 1;
          },
          () => {
            detachments += 1;
          },
        ),
      );
      draft.attachEditor('editor');
      await cleanup;
      expect(draft.state.value.owner).toBe('editor');
      expect(writes).toBe(0);
      expect(notifications).toBe(0);
      expect(detachments).toBe(0);
    } finally {
      await Effect.runPromise(draft.dispose());
    }
  });

  it('releases a detached editor and retains its draft when saving fails', async () => {
    const failure = new ConnectionError({ message: 'Offline' });
    const draft = fixture(
      'text',
      'version',
      () => Effect.fail(failure),
      () => false,
    );
    let notifications = 0;
    let detachments = 0;
    try {
      draft.claim('editor');
      draft.attachEditor('editor');
      await Effect.runPromise(draft.change('unsaved'));
      await Effect.runPromise(
        draft.finishEditing(
          'editor',
          () => {
            notifications += 1;
          },
          () => {
            detachments += 1;
          },
        ),
      );
      expect(draft.state.value).toMatchObject({
        owner: null,
        text: 'unsaved',
        savedText: 'text',
        error: failure,
      });
      expect(notifications).toBe(1);
      expect(detachments).toBe(1);
    } finally {
      await Effect.runPromise(draft.dispose());
    }
  });
});

it.effect(
  'coalesces rapid edits on the native clock and cancels their timers when the draft is disposed',
  () =>
    Effect.gen(function* () {
      const writes: string[] = [];
      const registry = fileDraftRuntime.runSync(FileDrafts);
      const draft = yield* registry
        .retain({
          environmentId: 'clock-draft',
          scope: { projectId: 'project', worktreeId: 'tree' },
          path: 'clock.txt',
          text: 'original',
          fingerprint: 'v1',
          writer: {
            write: ({ text }) =>
              Effect.sync(() => {
                writes.push(text);
                return 'v2';
              }),
          },
        })
        .pipe(
          Effect.provideService(FileDraftTiming, {
            autosave: Duration.seconds(1),
            diskNotice: Duration.seconds(2),
          }),
        );
      try {
        yield* draft.change('first');
        yield* TestClock.adjust('500 millis');
        yield* draft.change('second');
        yield* TestClock.adjust('999 millis');
        expect(writes).toEqual([]);
        expect(draft.state.value.savedText).toBe('original');
        yield* TestClock.adjust('1 millis');
        expect(writes).toEqual(['second']);
        expect(draft.state.value).toMatchObject({
          text: 'second',
          savedText: 'second',
          fingerprint: 'v2',
          saving: false,
        });
        yield* draft.change('third');
        yield* draft.dispose();
        yield* TestClock.adjust('2 seconds');
        expect(writes).toEqual(['second']);
        expect(draft.claim('editor')).toBe(false);
        expect(registry.entries({ environmentId: 'clock-draft' }).size).toBe(0);
      } finally {
        yield* draft.dispose();
      }
    }),
);

it.effect(
  'expires each disk notice on the native clock and protects a replacement notice from an old timer',
  () =>
    Effect.gen(function* () {
      const registry = fileDraftRuntime.runSync(FileDrafts);
      const draft = yield* registry
        .retain({
          environmentId: 'notice-draft',
          scope: { projectId: 'project', worktreeId: 'tree' },
          path: 'notice.txt',
          text: 'original',
          fingerprint: 'v1',
          writer: { write: () => Effect.succeed('v2') },
        })
        .pipe(
          Effect.provideService(FileDraftTiming, {
            autosave: Duration.seconds(1),
            diskNotice: Duration.seconds(2),
          }),
        );
      try {
        yield* draft.noticeDiskChange('viewer', 'disk-v2');
        yield* TestClock.adjust('1 second');
        yield* draft.forgetDiskChange('viewer');
        yield* draft.noticeDiskChange('viewer', 'disk-v3');
        yield* TestClock.adjust('1 second');
        expect([...draft.state.value.diskChanged]).toEqual(['viewer']);
        yield* TestClock.adjust('1 second');
        expect([...draft.state.value.diskChanged]).toEqual([]);
        yield* draft.noticeDiskChange('viewer', 'disk-v4');
        yield* draft.dispose();
        yield* TestClock.adjust('2 seconds');
        expect(registry.entries({ environmentId: 'notice-draft' }).size).toBe(
          0,
        );
      } finally {
        yield* draft.dispose();
      }
    }),
);

it.effect('keeps an admitted save alive when one caller cancels its wait', () =>
  Effect.gen(function* () {
    const entered = yield* Deferred.make<void>();
    const finish = yield* Deferred.make<string>();
    const writes: string[] = [];
    const draft = fixture('original', 'v1', (text) =>
      Effect.gen(function* () {
        writes.push(text);
        yield* Deferred.succeed(entered, undefined);
        return yield* Deferred.await(finish);
      }),
    );
    try {
      yield* draft.change('confirmed edit');
      const first = yield* Effect.forkChild(draft.save(), {
        startImmediately: true,
      });
      yield* Deferred.await(entered);
      const following = yield* Effect.forkChild(draft.save(), {
        startImmediately: true,
      });
      yield* Fiber.interrupt(first);
      expect(draft.state.value.saving).toBe(true);
      expect(writes).toEqual(['confirmed edit']);
      yield* Deferred.succeed(finish, 'v2');
      expect(yield* Fiber.join(following)).toBe(true);
      expect(draft.state.value).toMatchObject({
        savedText: 'confirmed edit',
        fingerprint: 'v2',
        saving: false,
      });
    } finally {
      yield* draft.dispose();
    }
  }),
);

it('drains an aborted foreign write before disposal returns and removes its retained entry', async () => {
  const entered = Promise.withResolvers<AbortSignal>();
  const aborted = Promise.withResolvers<void>();
  const drained = Promise.withResolvers<string>();
  const draft = fixture('original', 'v1', () =>
    nativeOperation((signal) => {
      signal.addEventListener('abort', () => aborted.resolve(), { once: true });
      entered.resolve(signal);
      return drained.promise;
    }),
  );
  await Effect.runPromise(draft.change('unsaved'));
  const saving = Effect.runPromise(draft.save()).catch(() => false);
  const signal = await entered.promise;
  let disposed = false;
  const disposing = Effect.runPromise(draft.dispose()).then(() => {
    disposed = true;
  });
  await aborted.promise;
  expect(signal.aborted).toBe(true);
  expect(disposed).toBe(false);
  drained.resolve('v2');
  await disposing;
  await saving;
  expect(draft.state.value.saving).toBe(false);
  expect(
    fileDraftRuntime
      .runSync(FileDrafts)
      .entries({ environmentId: 'portable-draft' }).size,
  ).toBe(0);
  expect(draft.claim('replacement')).toBe(false);
});
