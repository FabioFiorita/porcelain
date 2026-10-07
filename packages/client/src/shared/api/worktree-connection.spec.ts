import { Cause, Deferred, Effect, Exit, Fiber, Layer, Scope } from 'effect';
import { describe, expect, it } from 'vitest';
import { createWorktreeConnection } from './worktree-connection.ts';

const transport = () => Promise.resolve(Response.json({}));
const input = {
  environmentId: 'environment',
  transport,
  cacheIdentity: ['https://machine', 'device'],
  timeoutMs: 15_000,
};
const interrupted = <A, E>(exit: Exit.Exit<A, E>) =>
  Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause);

describe('a worktree connection owns its request lifetime', () => {
  it('keeps its transport and identity and drains every request when closed', async () => {
    const lifetime = createWorktreeConnection(input, undefined, Layer.empty);
    let released = 0;
    const started = Deferred.makeUnsafe<void>();
    const work = Effect.acquireUseRelease(
      Effect.sync(() => {
        released += 1;
      }),
      () => Effect.andThen(Deferred.succeed(started, undefined), Effect.never),
      () =>
        Effect.sync(() => {
          released -= 1;
        }),
    );
    const first = Effect.runFork(lifetime.connection.request(work));
    await Effect.runPromise(Deferred.await(started));
    const second = Effect.runFork(lifetime.connection.request(work));
    expect(lifetime.connection.transport).toBe(transport);
    expect(lifetime.connection.cacheIdentity).toEqual([
      'https://machine',
      'device',
    ]);
    await lifetime.close();
    expect(released).toBe(0);
    expect(interrupted(await Effect.runPromise(Fiber.await(first)))).toBe(true);
    expect(interrupted(await Effect.runPromise(Fiber.await(second)))).toBe(
      true,
    );
    let calls = 0;
    expect(
      interrupted(
        await Effect.runPromiseExit(
          lifetime.connection.request(
            Effect.sync(() => {
              calls += 1;
            }),
          ),
        ),
      ),
    ).toBe(true);
    expect(calls).toBe(0);
  });

  it('interrupts a caller fiber and releases its work without closing its connection', async () => {
    const lifetime = createWorktreeConnection(input, undefined, Layer.empty);
    const started = Deferred.makeUnsafe<void>();
    let released = false;
    const fiber = Effect.runFork(
      lifetime.connection.request(
        Effect.andThen(Deferred.succeed(started, undefined), Effect.never).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              released = true;
            }),
          ),
        ),
      ),
    );
    await Effect.runPromise(Deferred.await(started));
    await Effect.runPromise(Fiber.interrupt(fiber));
    expect(released).toBe(true);
    expect(
      await Effect.runPromise(
        lifetime.connection.request(Effect.succeed('connected')),
      ),
    ).toBe('connected');
    await lifetime.close();
  });

  it('closes one caller scope without cancelling another caller on the same connection', async () => {
    const lifetime = createWorktreeConnection(input, undefined, Layer.empty);
    const caller = Scope.makeUnsafe();
    const other = Scope.makeUnsafe();
    const started = Deferred.makeUnsafe<void>();
    const secondStarted = Deferred.makeUnsafe<void>();
    let released = 0;
    const work = Effect.andThen(
      Deferred.succeed(started, undefined),
      Effect.never,
    ).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          released += 1;
        }),
      ),
    );
    const first = Effect.runFork(lifetime.connection.request(work, caller));
    await Effect.runPromise(Deferred.await(started));
    const second = Effect.runFork(
      lifetime.connection.request(
        Effect.andThen(
          Deferred.succeed(secondStarted, undefined),
          Effect.never,
        ).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              released += 1;
            }),
          ),
        ),
        other,
      ),
    );
    await Effect.runPromise(Deferred.await(secondStarted));
    await Effect.runPromise(Scope.close(caller, Exit.void));
    expect(interrupted(await Effect.runPromise(Fiber.await(first)))).toBe(true);
    expect(released).toBe(1);
    expect(lifetime.connection.isClosed()).toBe(false);
    await lifetime.close();
    expect(interrupted(await Effect.runPromise(Fiber.await(second)))).toBe(
      true,
    );
    expect(released).toBe(2);
    await Effect.runPromise(Scope.close(other, Exit.void));
  });

  it('starts a fresh deadline on every execution of a retained request', async () => {
    const lifetime = createWorktreeConnection(
      { ...input, timeoutMs: 5 },
      undefined,
      Layer.empty,
    );
    let released = 0;
    const request = lifetime.connection.request(
      Effect.never.pipe(
        Effect.ensuring(
          Effect.sync(() => {
            released += 1;
          }),
        ),
      ),
    );
    expect(interrupted(await Effect.runPromiseExit(request))).toBe(true);
    expect(interrupted(await Effect.runPromiseExit(request))).toBe(true);
    expect(released).toBe(2);
    expect(lifetime.connection.isClosed()).toBe(false);
    await lifetime.close();
  });

  it('opens a fresh lifetime without reviving a closed connection', async () => {
    const old = createWorktreeConnection(input, undefined, Layer.empty);
    await old.close();
    const current = createWorktreeConnection(input, undefined, Layer.empty);
    expect(old.connection.isClosed()).toBe(true);
    expect(
      await Effect.runPromise(
        current.connection.request(Effect.succeed('new')),
      ),
    ).toBe('new');
    expect(current.connection).not.toBe(old.connection);
    await current.close();
  });
});
