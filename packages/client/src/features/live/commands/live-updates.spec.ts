import { expect, it } from '@effect/vitest';
import { Cause, Effect, Queue } from 'effect';
import { Socket } from 'effect/socket';
import { TestClock } from 'effect/testing';
import type { LiveNotice } from '@porcelain/contracts/access';
import { RequestError } from '@porcelain/client/transport';
import { createLiveUpdates } from './live-updates.ts';

function socketPort() {
  const frames = Effect.runSync(Queue.make<string, Socket.SocketError>());
  const closed = Effect.runSync(Queue.make<void>());
  const written = Effect.runSync(Queue.make<string>());
  const socket = Socket.make({
    reader: Effect.acquireRelease(
      Effect.succeed({
        pull: Effect.map(Queue.take(frames), (frame) => [frame] as const),
        upgrade: () => Effect.void,
      }),
      () =>
        Effect.sync(() => {
          Queue.offerUnsafe(closed, undefined);
        }),
    ),
    writer: Effect.succeed({
      write: (frame) =>
        Effect.sync(() => {
          if (typeof frame === 'string') Queue.offerUnsafe(written, frame);
        }),
      writeAll: (batch) =>
        Effect.sync(() => {
          for (const frame of batch)
            if (typeof frame === 'string') Queue.offerUnsafe(written, frame);
        }),
    }),
  });
  return {
    socket,
    frames,
    written,
    closed,
    disconnect: (code: number) =>
      Queue.failCauseUnsafe(
        frames,
        Cause.fail(
          new Socket.SocketError({
            reason: new Socket.SocketCloseError({ code }),
          }),
        ),
      ),
  };
}

it.effect(
  'reconnects after the bounded delay, resends the subscription and closes sockets on cancellation',
  () =>
    Effect.gen(function* () {
      const openings = yield* Queue.make<ReturnType<typeof socketPort>>();
      const notices = yield* Queue.make<LiveNotice>();
      let reconnects = 0;
      let revoked = 0;
      const signal = new AbortController();
      yield* Effect.addFinalizer(() => Effect.sync(() => signal.abort()));
      const port = createLiveUpdates(
        Effect.sync(() => {
          const opened = socketPort();
          Queue.offerUnsafe(openings, opened);
          return opened.socket;
        }),
        yield* Effect.context(),
      );
      const live = port.connect({
        signal: signal.signal,
        onNotice: (notice) => {
          Queue.offerUnsafe(notices, notice);
        },
        onReconnect: () => {
          reconnects += 1;
        },
        onUnauthorized: () => {
          revoked += 1;
        },
      });
      const subscription = {
        type: 'subscribe',
        projects: ['11111111-1111-4111-8111-111111111111'],
        worktrees: [],
      } as const;
      live.subscribe(subscription);
      const first = yield* Queue.take(openings);
      Queue.offerUnsafe(first.frames, JSON.stringify({ type: 'ready' }));
      expect((yield* Queue.take(notices)).type).toBe('ready');
      expect(yield* Queue.take(first.written)).toBe(
        JSON.stringify(subscription),
      );
      first.disconnect(1006);
      yield* Queue.take(first.closed);
      yield* TestClock.adjust(499);
      expect(yield* Queue.size(openings)).toBe(0);
      yield* TestClock.adjust(1);
      const second = yield* Queue.take(openings);
      Queue.offerUnsafe(second.frames, JSON.stringify({ type: 'ready' }));
      expect((yield* Queue.take(notices)).type).toBe('ready');
      expect(yield* Queue.take(second.written)).toBe(
        JSON.stringify(subscription),
      );
      expect(reconnects).toBe(1);
      expect(revoked).toBe(0);
      signal.abort();
      yield* Queue.take(second.closed);
      yield* TestClock.adjust(20000);
      expect(yield* Queue.size(openings)).toBe(0);
    }),
);

it.effect('a revoked socket closes without scheduling another connection', () =>
  Effect.gen(function* () {
    const opened = socketPort();
    const revoked = yield* Queue.make<void>();
    let openings = 0;
    const signal = new AbortController();
    yield* Effect.addFinalizer(() => Effect.sync(() => signal.abort()));
    createLiveUpdates(
      Effect.sync(() => {
        openings += 1;
        return opened.socket;
      }),
      yield* Effect.context(),
    ).connect({
      signal: signal.signal,
      onNotice: () => {},
      onReconnect: () => {},
      onUnauthorized: () => {
        Queue.offerUnsafe(revoked, undefined);
      },
    });
    yield* Effect.yieldNow;
    opened.disconnect(4001);
    yield* Queue.take(revoked);
    yield* Queue.take(opened.closed);
    yield* TestClock.adjust(20000);
    expect(openings).toBe(1);
  }),
);

it.effect('a rejected live ticket stops before opening a socket', () =>
  Effect.gen(function* () {
    const revoked = yield* Queue.make<void>();
    let attempts = 0;
    const signal = new AbortController();
    yield* Effect.addFinalizer(() => Effect.sync(() => signal.abort()));
    createLiveUpdates(
      Effect.suspend(() => {
        attempts += 1;
        return Effect.fail(
          new RequestError({ status: 401, message: 'Access revoked' }),
        );
      }),
      yield* Effect.context(),
    ).connect({
      signal: signal.signal,
      onNotice: () => {},
      onReconnect: () => {},
      onUnauthorized: () => {
        Queue.offerUnsafe(revoked, undefined);
      },
    });
    yield* Queue.take(revoked);
    yield* TestClock.adjust(20000);
    expect(attempts).toBe(1);
  }),
);
