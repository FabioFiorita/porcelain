import { ENVIRONMENT_PROTOCOL } from '@porcelain/contracts/shared';
import { expect, it } from '@effect/vitest';
import { Cause, Effect, Exit, Queue, Scope, Stream, Redacted } from 'effect';
import { createRouteTransport } from '../../access/store/route-transport.ts';
import { remoteLiveUpdates } from './remote-live-updates.ts';
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
          return yield* recordedSocket(serverScope, openings);
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
          return yield* recordedSocket(serverScope, openings);
        }),
        yield* Effect.context(),
      )
        .connect(revocationCallbacks(revoked))
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
      .connect(revocationCallbacks(revoked))
      .pipe(Effect.provideService(Scope.Scope, scope));
    yield* Queue.take(revoked);
    yield* TestClock.adjust(20000);
    expect(attempts).toBe(1);
  }),
);

const recordedSocket = Effect.fn(function* (
  serverScope: Scope.Scope,
  openings: Queue.Queue<Effect.Success<typeof socketPort>>,
) {
  const opened = yield* socketPort.pipe(
    Effect.provideService(Scope.Scope, serverScope),
  );
  yield* Queue.offer(openings, opened);
  return opened.socket;
});
function revocationCallbacks(revoked: Queue.Queue<void>) {
  return {
    onNotice: () => {},
    onReconnect: () => {},
    onUnauthorized: () => {
      Queue.offerUnsafe(revoked, undefined);
    },
  };
}

function activityFixture() {
  let active = true;
  let changed: (() => void) | undefined;
  return {
    port: {
      isActive: () => active,
      subscribe: (listener: () => void) => {
        changed = listener;
        return () => {
          changed = undefined;
        };
      },
    },
    setActive(value: boolean) {
      active = value;
      changed?.();
    },
    subscribed: () => changed !== undefined,
  };
}

function routedFixture() {
  const remote = {
    environmentId: 'computer',
    name: 'Computer',
    address: 'http://192.168.1.2:4738',
    credential: Redacted.make('lan'),
    alternateRoutes: [
      {
        address: 'https://development.example.ts.net',
        credential: Redacted.make('tailnet'),
      },
    ],
  };
  let revoked = false;
  let tailnetAvailable = true;
  const routing = createRouteTransport(remote, async (url) => {
    if (!tailnetAvailable && url.hostname === 'development.example.ts.net')
      throw new TypeError('VPN unavailable');
    if (
      revoked &&
      url.hostname === '192.168.1.2' &&
      url.pathname === '/api/session'
    )
      return new Response(null, { status: 401 });
    return Response.json(
      url.pathname === '/api/health'
        ? { status: 'ok', environmentId: 'computer' }
        : url.pathname === '/api/environment'
          ? {
              environmentId: 'computer',
              name: 'Computer',
              version: null,
              protocol: ENVIRONMENT_PROTOCOL,
            }
          : url.pathname === '/api/live/tickets'
            ? { ticket: 'ticket', expiresAt: '2026-10-18T00:00:00.000Z' }
            : { kind: 'owner' },
    );
  });
  return {
    remote,
    routing,
    revokeLan() {
      revoked = true;
    },
    tailnet(value: boolean) {
      tailnetAvailable = value;
    },
  };
}

const routedSession = Effect.fn(function* (
  lan: 'online' | 'revoked' | 'bad-upgrade' = 'online',
) {
  const { serverScope, scope, openings } = yield* reconnectionFixture;
  const subject = routedFixture();
  const failedUpgrades = yield* Queue.make<void>();
  const activity = activityFixture();
  const hosts: string[] = [];
  let unauthorized = 0;
  if (lan === 'revoked') {
    subject.revokeLan();
    subject.tailnet(false);
  }
  yield* remoteLiveUpdates(
    subject.remote.address,
    subject.routing.transport,
    (url) => {
      const host = new URL(url).hostname;
      hosts.push(host);
      return lan === 'bad-upgrade' && host === '192.168.1.2'
        ? Effect.succeed(
            Socket.make({
              reader: Queue.offer(failedUpgrades, undefined).pipe(
                Effect.andThen(
                  Effect.fail(
                    new Socket.SocketError({
                      reason: new Socket.SocketOpenError({
                        kind: 'Unknown',
                        cause: 'Upgrade unavailable',
                      }),
                    }),
                  ),
                ),
              ),
              writer: Effect.succeed({
                write: () => Effect.void,
                writeAll: () => Effect.void,
              }),
            }),
          )
        : recordedSocket(serverScope, openings);
    },
    subject.routing,
    activity.port,
  )
    .connect({
      onNotice() {},
      onReconnect() {},
      onUnauthorized() {
        unauthorized++;
      },
    })
    .pipe(Effect.provideService(Scope.Scope, scope));
  return {
    failedUpgrades,
    subject,
    activity,
    hosts,
    scope,
    openings,
    unauthorized: () => unauthorized,
  };
});

it.effect(
  'a socket upgrade failure tries the alternate before reopening the preferred route',
  () =>
    Effect.gen(function* () {
      const session = yield* routedSession('bad-upgrade');
      yield* Queue.take(session.failedUpgrades);
      yield* TestClock.adjust(500);
      expect(session.hosts).toEqual([
        '192.168.1.2',
        'development.example.ts.net',
      ]);
      const opened = yield* Queue.take(session.openings);
      yield* Queue.take(opened.followed);
      yield* Scope.close(session.scope, Exit.void);
    }),
);

it.effect(
  'a failed LAN socket advances to Tailscale even when LAN HTTP stays healthy, and foreground restores preference',
  () =>
    Effect.gen(function* () {
      const { scope, openings, hosts, activity } = yield* routedSession();
      const first = yield* Queue.take(openings);
      yield* Queue.take(first.followed);
      first.disconnect(1006);
      yield* Queue.take(first.closed);
      yield* TestClock.adjust(500);
      const second = yield* Queue.take(openings);
      yield* Queue.take(second.followed);
      expect(hosts).toEqual(['192.168.1.2', 'development.example.ts.net']);
      activity.setActive(false);
      activity.setActive(true);
      yield* Queue.take(second.closed);
      yield* TestClock.adjust(1);
      const third = yield* Queue.take(openings);
      yield* Queue.take(third.followed);
      expect(hosts).toEqual([
        '192.168.1.2',
        'development.example.ts.net',
        '192.168.1.2',
      ]);
      yield* Scope.close(scope, Exit.void);
    }),
);

const mixedRecovery = Effect.fn(function* (established: boolean) {
  const session = yield* routedSession(established ? 'online' : 'revoked');
  if (established) {
    const first = yield* Queue.take(session.openings);
    yield* Queue.take(first.followed);
    session.subject.revokeLan();
    session.subject.tailnet(false);
    first.disconnect(4001);
    yield* Queue.take(first.closed);
  }
  yield* TestClock.adjust(1000);
  const lostAccess = session.unauthorized();
  session.subject.tailnet(true);
  yield* TestClock.adjust(1000);
  let subscribed = false;
  if ((yield* Queue.size(session.openings)) > 0) {
    const recovered = yield* Queue.take(session.openings);
    yield* Queue.take(recovered.followed);
    subscribed = true;
  }
  yield* Scope.close(session.scope, Exit.void);
  return { lostAccess, hosts: session.hosts, subscribed };
});

it.effect(
  'a revoked route and an offline alternate recover before any socket has connected',
  () =>
    Effect.gen(function* () {
      expect(yield* mixedRecovery(false)).toEqual({
        lostAccess: 0,
        hosts: ['development.example.ts.net'],
        subscribed: true,
      });
    }),
);
it.effect(
  'an established revoked socket keeps retrying until its offline alternate recovers',
  () =>
    Effect.gen(function* () {
      const recovered = yield* mixedRecovery(true);
      expect(recovered.lostAccess).toBe(0);
      expect(recovered.hosts).toEqual([
        '192.168.1.2',
        'development.example.ts.net',
      ]);
      expect(recovered.subscribed).toBe(true);
    }),
);

const reconnectionFixture = Effect.gen(function* () {
  const serverScope = yield* Scope.Scope;
  const scope = yield* Scope.fork(serverScope, 'sequential');
  const openings = yield* Queue.make<Effect.Success<typeof socketPort>>();
  return { serverScope, scope, openings };
});

it.effect(
  'reopens the live session on foreground and releases its activity listener on close',
  () =>
    Effect.gen(function* () {
      const { serverScope, scope, openings } = yield* reconnectionFixture;
      const activity = activityFixture();
      let reconnects = 0;
      yield* createLiveUpdates(
        recordedSocket(serverScope, openings),
        yield* Effect.context(),
        {
          activity: activity.port,
        },
      )
        .connect({
          onNotice: () => {},
          onReconnect: () => {
            reconnects++;
          },
          onUnauthorized: () => {},
        })
        .pipe(Effect.provideService(Scope.Scope, scope));
      const first = yield* Queue.take(openings);
      yield* Queue.take(first.followed);
      activity.setActive(false);
      activity.setActive(true);
      yield* Queue.take(first.closed);
      yield* TestClock.adjust(500);
      const second = yield* Queue.take(openings);
      yield* Queue.take(second.followed);
      expect(reconnects).toBe(1);
      yield* Scope.close(scope, Exit.void);
      yield* Queue.take(second.closed);
      expect(activity.subscribed()).toBe(false);
    }),
);

it.effect(
  'recovers a revoked socket through an authorized alternate route before reporting lost access',
  () =>
    Effect.gen(function* () {
      const { serverScope, scope, openings } = yield* reconnectionFixture;
      let recovered = 0;
      let revoked = 0;
      yield* createLiveUpdates(
        recordedSocket(serverScope, openings),
        yield* Effect.context(),
        {
          recoverUnauthorized: () =>
            Effect.sync(() => {
              recovered++;
              return true;
            }),
        },
      )
        .connect({
          onNotice: () => {},
          onReconnect: () => {},
          onUnauthorized: () => {
            revoked++;
          },
        })
        .pipe(Effect.provideService(Scope.Scope, scope));
      const first = yield* Queue.take(openings);
      yield* Queue.take(first.followed);
      first.disconnect(4001);
      yield* Queue.take(first.closed);
      yield* TestClock.adjust(500);
      const second = yield* Queue.take(openings);
      yield* Queue.take(second.followed);
      expect(recovered).toBe(1);
      expect(revoked).toBe(0);
      yield* Scope.close(scope, Exit.void);
    }),
);

it.effect(
  'foreground interrupts reconnect backoff without cancelling the replacement attempt',
  () =>
    Effect.gen(function* () {
      const scope = yield* Scope.fork(yield* Scope.Scope, 'sequential');
      const activity = activityFixture();
      let attempts = 0;
      const started = yield* Queue.make<void>();
      yield* createLiveUpdates(
        Effect.suspend(() => {
          attempts++;
          Queue.offerUnsafe(started, undefined);
          return attempts === 1
            ? Effect.fail(new RequestError({ status: 503, message: 'Offline' }))
            : Effect.never;
        }),
        undefined,
        {
          activity: activity.port,
        },
      )
        .connect({
          onNotice: () => {},
          onReconnect: () => {},
          onUnauthorized: () => {},
        })
        .pipe(Effect.provideService(Scope.Scope, scope));
      yield* Queue.take(started);
      yield* TestClock.adjust(100);
      activity.setActive(false);
      activity.setActive(true);
      yield* TestClock.adjust(1);
      expect(attempts).toBe(2);
      yield* TestClock.adjust(20000);
      expect(attempts).toBe(2);
      yield* Scope.close(scope, Exit.void);
    }),
);
