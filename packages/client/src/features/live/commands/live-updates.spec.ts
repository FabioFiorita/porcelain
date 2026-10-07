import { expect, it } from '@effect/vitest';
import { Cause, Effect, Exit, Queue, Scope, Stream } from 'effect';
import { RpcSerialization, RpcServer } from 'effect/rpc';
import { Socket, SocketServer } from 'effect/socket';
import { NetAddress } from 'effect/net';
import { TestClock } from 'effect/testing';
import { LiveUpdatesRpc, type LiveNotice } from '@porcelain/contracts/access';
import { RequestError } from '@porcelain/client/transport';
import type { LiveSubscription } from '../ports/live-update.ts';
import { createLiveUpdates } from './live-updates.ts';

const socketPort = Effect.gen(function* () {
  const frames = yield* Queue.make<string, Socket.SocketError>();
  const requests = yield* Queue.make<string, Socket.SocketError>();
  const closed = yield* Queue.make<void>();
  const followed = yield* Queue.make<LiveSubscription>();
  const notices = yield* Queue.make<LiveNotice>();
  const socket = Socket.make({
    reader: Effect.acquireRelease(
      Effect.succeed({
        pull: Effect.map(Queue.take(frames), (frame) => [frame] as const),
        upgrade: () => Effect.void,
      }),
      () =>
        Effect.gen(function* () {
          yield* Queue.failCause(
            requests,
            Cause.fail(
              new Socket.SocketError({
                reason: new Socket.SocketCloseError({ code: 1000 }),
              }),
            ),
          );
          yield* Queue.offer(closed, undefined);
        }),
    ),
    writer: Effect.succeed({
      write: (frame) =>
        typeof frame === 'string'
          ? Queue.offer(requests, frame).pipe(Effect.asVoid)
          : Effect.void,
      writeAll: (batch) =>
        Effect.forEach(
          batch,
          (frame) =>
            typeof frame === 'string'
              ? Queue.offer(requests, frame)
              : Effect.void,
          { discard: true },
        ),
    }),
  });
  const serverSocket = Socket.make({
    reader: Effect.succeed({
      pull: Effect.map(Queue.take(requests), (frame) => [frame] as const),
      upgrade: () => Effect.void,
    }),
    writer: Effect.succeed({
      write: (frame) =>
        typeof frame === 'string'
          ? Queue.offer(frames, frame).pipe(Effect.asVoid)
          : Effect.void,
      writeAll: (batch) =>
        Effect.forEach(
          batch,
          (frame) =>
            typeof frame === 'string'
              ? Queue.offer(frames, frame)
              : Effect.void,
          { discard: true },
        ),
    }),
  });
  const protocol = yield* RpcServer.makeProtocolSocketServer.pipe(
    Effect.provideService(SocketServer.SocketServer, {
      address: NetAddress.unixPathAddress('/live-rpc-test'),
      run: (handle) =>
        handle(serverSocket).pipe(Effect.orDie, Effect.andThen(Effect.never)),
    }),
    Effect.provideService(
      RpcSerialization.RpcSerialization,
      RpcSerialization.json,
    ),
  );
  const handlers = yield* LiveUpdatesRpc.toHandlers({
    notices: () =>
      Stream.concat(
        Stream.succeed<LiveNotice>({ type: 'ready' }),
        Stream.fromQueue(notices),
      ),
    follow: (value) =>
      Queue.offer(followed, value).pipe(
        Effect.andThen(Queue.offer(notices, { type: 'subscribed' })),
        Effect.asVoid,
      ),
  });
  yield* RpcServer.make(LiveUpdatesRpc, { disableTracing: true }).pipe(
    Effect.provideContext(handlers),
    Effect.provideService(RpcServer.Protocol, protocol),
    Effect.forkScoped,
  );
  yield* Effect.addFinalizer(() =>
    Queue.failCause(
      requests,
      Cause.fail(
        new Socket.SocketError({
          reason: new Socket.SocketCloseError({ code: 1000 }),
        }),
      ),
    ),
  );
  return {
    socket,
    followed,
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
});

it.effect(
  'reconnects after the bounded delay, resends the typed subscription and closes sockets on cancellation',
  () =>
    Effect.gen(function* () {
      const openings = yield* Queue.make<Effect.Success<typeof socketPort>>();
      const notices = yield* Queue.make<LiveNotice>();
      let reconnects = 0;
      let revoked = 0;
      const scope = yield* Scope.fork(yield* Scope.Scope, 'sequential');
      const serverScope = yield* Scope.Scope;
      const port = createLiveUpdates(
        Effect.gen(function* () {
          const opened = yield* socketPort.pipe(
            Effect.provideService(Scope.Scope, serverScope),
          );
          yield* Queue.offer(openings, opened);
          return opened.socket;
        }),
        yield* Effect.context(),
      );
      const live = yield* port
        .connect({
          onNotice: (notice) => {
            Queue.offerUnsafe(notices, notice);
          },
          onReconnect: () => {
            reconnects += 1;
          },
          onUnauthorized: () => {
            revoked += 1;
          },
        })
        .pipe(Effect.provideService(Scope.Scope, scope));
      const subscription = {
        projects: ['11111111-1111-4111-8111-111111111111'],
        worktrees: [],
      } as const;
      live.subscribe(subscription);
      const first = yield* Queue.take(openings);
      expect((yield* Queue.take(notices)).type).toBe('ready');
      expect(yield* Queue.take(first.followed)).toStrictEqual(subscription);
      first.disconnect(1006);
      yield* Queue.take(first.closed);
      yield* TestClock.adjust(499);
      expect(yield* Queue.size(openings)).toBe(0);
      yield* TestClock.adjust(1);
      const second = yield* Queue.take(openings);
      let next = yield* Queue.take(notices);
      while (next.type !== 'ready') next = yield* Queue.take(notices);
      expect(yield* Queue.take(second.followed)).toStrictEqual(subscription);
      expect(reconnects).toBe(1);
      expect(revoked).toBe(0);
      yield* Scope.close(scope, Exit.void);
      yield* Queue.take(second.closed);
      yield* TestClock.adjust(20000);
      expect(yield* Queue.size(openings)).toBe(0);
    }),
);

it.effect(
  'a revoked RPC socket closes without scheduling another connection',
  () =>
    Effect.gen(function* () {
      const serverScope = yield* Scope.Scope;
      const revoked = yield* Queue.make<void>();
      const openings = yield* Queue.make<Effect.Success<typeof socketPort>>();
      let attempts = 0;
      const scope = yield* Scope.fork(yield* Scope.Scope, 'sequential');
      yield* createLiveUpdates(
        Effect.gen(function* () {
          attempts += 1;
          const opened = yield* socketPort.pipe(
            Effect.provideService(Scope.Scope, serverScope),
          );
          yield* Queue.offer(openings, opened);
          return opened.socket;
        }),
        yield* Effect.context(),
      )
        .connect({
          onNotice: () => {},
          onReconnect: () => {},
          onUnauthorized: () => {
            Queue.offerUnsafe(revoked, undefined);
          },
        })
        .pipe(Effect.provideService(Scope.Scope, scope));
      const opened = yield* Queue.take(openings);
      opened.disconnect(4001);
      yield* Queue.take(revoked);
      yield* Queue.take(opened.closed);
      yield* TestClock.adjust(20000);
      expect(attempts).toBe(1);
    }),
);

it.effect('a rejected live ticket stops before opening an RPC socket', () =>
  Effect.gen(function* () {
    const revoked = yield* Queue.make<void>();
    let attempts = 0;
    const scope = yield* Scope.fork(yield* Scope.Scope, 'sequential');
    yield* createLiveUpdates(
      Effect.suspend(() => {
        attempts += 1;
        return Effect.fail(
          new RequestError({ status: 401, message: 'Access revoked' }),
        );
      }),
      yield* Effect.context(),
    )
      .connect({
        onNotice: () => {},
        onReconnect: () => {},
        onUnauthorized: () => {
          Queue.offerUnsafe(revoked, undefined);
        },
      })
      .pipe(Effect.provideService(Scope.Scope, scope));
    yield* Queue.take(revoked);
    yield* TestClock.adjust(20000);
    expect(attempts).toBe(1);
  }),
);
