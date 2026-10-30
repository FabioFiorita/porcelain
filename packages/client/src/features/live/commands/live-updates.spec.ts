import { ENVIRONMENT_PROTOCOL } from '@porcelain/contracts/shared';
import { expect, it } from '@effect/vitest';
import {
  Cause,
  Clock,
  Context,
  Effect,
  Exit,
  Queue,
  Scope,
  Stream,
  Redacted,
} from 'effect';
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

const socketPort = (sendReady = true) =>
  Effect.gen(function* () {
    let silent = false;
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
          !silent && typeof frame === 'string'
            ? Queue.offer(frames, frame).pipe(Effect.asVoid)
            : Effect.void,
        writeAll: (batch) =>
          Effect.forEach(
            batch,
            (frame) =>
              !silent && typeof frame === 'string'
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
          sendReady
            ? Stream.succeed<LiveNotice>({ type: 'ready' })
            : Stream.never,
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
      silence: () => {
        silent = true;
      },
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
      const openings =
        yield* Queue.make<Effect.Success<ReturnType<typeof socketPort>>>();
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
      const openings =
        yield* Queue.make<Effect.Success<ReturnType<typeof socketPort>>>();
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
  openings: Queue.Queue<Effect.Success<ReturnType<typeof socketPort>>>,
  sendReady: boolean = true,
) {
  const opened = yield* socketPort(sendReady).pipe(
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

function savedRouteResponse(path: string) {
  return Response.json(
    path === '/api/health'
      ? { status: 'ok', environmentId: 'computer' }
      : path === '/api/environment'
        ? {
            environmentId: 'computer',
            name: 'Computer',
            version: null,
            protocol: ENVIRONMENT_PROTOCOL,
          }
        : path === '/api/live/tickets'
          ? { ticket: 'ticket', expiresAt: '2026-10-18T00:00:00.000Z' }
          : { kind: 'owner' },
  );
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
    return savedRouteResponse(url.pathname);
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
  'a failed LAN socket advances to Tailscale and foreground preserves the healthy fallback',
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
      yield* TestClock.adjust(1);
      expect(yield* Queue.size(second.closed)).toBe(0);
      expect(yield* Queue.size(openings)).toBe(0);
      expect(hosts).toEqual(['192.168.1.2', 'development.example.ts.net']);
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
  const openings =
    yield* Queue.make<Effect.Success<ReturnType<typeof socketPort>>>();
  return { serverScope, scope, openings };
});

it.effect(
  'probes a healthy live session on foreground without reopening it and releases its activity listener',
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
      yield* TestClock.adjust(1);
      expect(yield* Queue.size(first.closed)).toBe(0);
      expect(yield* Queue.size(openings)).toBe(0);
      expect(reconnects).toBe(0);
      yield* Queue.take(first.followed);
      yield* Scope.close(scope, Exit.void);
      yield* Queue.take(first.closed);
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
  'an active network hint interrupts reconnect backoff without cancelling the replacement attempt',
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
      activity.setActive(true);
      yield* TestClock.adjust(1);
      expect(attempts).toBe(2);
      yield* TestClock.adjust(20000);
      expect(attempts).toBe(2);
      yield* Scope.close(scope, Exit.void);
    }),
);

const observedSession = Effect.fn(function* (initialReady: boolean = true) {
  const fixture = yield* reconnectionFixture;
  const activity = activityFixture();
  const ready = yield* Queue.make<void>();
  const refreshed = yield* Queue.make<void>();
  const clock = yield* Clock.Clock;
  let elapsed = 0n;
  const monotonic = () => clock.monotonicTimeNanosUnsafe() + elapsed;
  const activityClock: Clock.Clock = {
    currentTimeMillisUnsafe: () => clock.currentTimeMillisUnsafe(),
    currentTimeMillis: clock.currentTimeMillis,
    currentTimeNanosUnsafe: () => clock.currentTimeNanosUnsafe(),
    currentTimeNanos: clock.currentTimeNanos,
    monotonicTimeNanosUnsafe: monotonic,
    monotonicTimeNanos: Effect.sync(monotonic),
    sleep: clock.sleep.bind(clock),
  };
  const context = Context.add(
    yield* Effect.context(),
    Clock.Clock,
    activityClock,
  );
  let refreshes = 0;
  let attempts = 0;
  const port = createLiveUpdates(
    Effect.suspend(() => {
      attempts++;
      return recordedSocket(
        fixture.serverScope,
        fixture.openings,
        initialReady || attempts > 1,
      );
    }),
    context,
    { activity: activity.port },
  );
  yield* port
    .connect({
      onNotice(notice) {
        if (notice.type === 'ready') Queue.offerUnsafe(ready, undefined);
      },
      onReconnect() {
        refreshes++;
        Queue.offerUnsafe(refreshed, undefined);
      },
      onUnauthorized() {},
    })
    .pipe(
      Effect.provideService(Clock.Clock, activityClock),
      Effect.provideService(Scope.Scope, fixture.scope),
    );
  return {
    ...fixture,
    activity,
    ready,
    refreshed,
    port,
    refreshes: () => refreshes,
    attempts: () => attempts,
    elapse: (ms: number) => {
      elapsed += BigInt(ms) * 1_000_000n;
    },
  };
});

const connectedSession = Effect.gen(function* () {
  const subject = yield* observedSession();
  const first = yield* Queue.take(subject.openings);
  yield* Queue.take(subject.ready);
  yield* Queue.take(first.followed);
  return { ...subject, first };
});

it.effect(
  'refreshes after a long suspension while retaining a healthy session',
  () =>
    Effect.gen(function* () {
      const subject = yield* connectedSession;
      const first = subject.first;
      subject.activity.setActive(false);
      subject.elapse(30000);
      subject.activity.setActive(true);
      subject.activity.setActive(true);
      yield* Queue.take(first.followed);
      yield* Queue.take(subject.refreshed);
      yield* Queue.take(subject.ready);
      expect(subject.refreshes()).toBe(1);
      expect(subject.port.state.value).toBe('connected');
      expect(yield* Queue.size(first.closed)).toBe(0);
      expect(yield* Queue.size(subject.openings)).toBe(0);
      yield* Scope.close(subject.scope, Exit.void);
      expect(subject.port.state.value).toBe('idle');
    }),
);

it.effect(
  'replaces a silently dead session after the foreground round trip fails',
  () =>
    Effect.gen(function* () {
      const subject = yield* connectedSession;
      const first = subject.first;
      first.silence();
      subject.activity.setActive(false);
      subject.activity.setActive(true);
      yield* Queue.take(first.followed);
      yield* TestClock.adjust(10000);
      yield* Queue.take(first.closed);
      expect(subject.port.state.value).toBe('reconnecting');
      yield* TestClock.adjust(500);
      const second = yield* Queue.take(subject.openings);
      yield* Queue.take(subject.ready);
      expect(subject.port.state.value).toBe('connected');
      expect(yield* Queue.size(second.closed)).toBe(0);
      yield* Scope.close(subject.scope, Exit.void);
    }),
);

it.effect('bounds an RPC session that never becomes ready', () =>
  Effect.gen(function* () {
    const subject = yield* observedSession(false);
    const first = yield* Queue.take(subject.openings);
    yield* TestClock.adjust(10000);
    yield* Queue.take(first.closed);
    yield* TestClock.adjust(500);
    yield* Queue.take(subject.ready);
    expect(subject.attempts()).toBe(2);
    expect(subject.port.state.value).toBe('connected');
    yield* Scope.close(subject.scope, Exit.void);
  }),
);

it.effect(
  'reaches a healthy fifth route after four bounded unreachable routes',
  () =>
    Effect.gen(function* () {
      const { scope, serverScope, openings } = yield* reconnectionFixture;
      const probed = yield* Queue.make<string>();
      const routes = Array.from({ length: 5 }, (_, index) => ({
        address: `http://route-${index}.example`,
        credential: Redacted.make(`route-${index}`),
      }));
      const first = routes[0];
      if (!first) return yield* Effect.die('No preferred route');
      const remote = {
        ...first,
        environmentId: 'computer',
        name: 'Computer',
        alternateRoutes: routes.slice(1),
      };
      const routing = createRouteTransport(remote, (url, init) => {
        if (url.pathname === '/api/health')
          Queue.offerUnsafe(probed, url.hostname);
        if (url.hostname !== 'route-4.example')
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => reject(init.signal?.reason),
              { once: true },
            );
          });
        return Promise.resolve(savedRouteResponse(url.pathname));
      });
      const port = remoteLiveUpdates(
        remote.address,
        routing.transport,
        () => recordedSocket(serverScope, openings),
        routing,
      );
      yield* port
        .connect({ onNotice() {}, onReconnect() {}, onUnauthorized() {} })
        .pipe(Effect.provideService(Scope.Scope, scope));
      const seen: string[] = [];
      for (let index = 0; index < 4; index++) {
        seen.push(yield* Queue.take(probed));
        yield* TestClock.adjust(2500);
      }
      seen.push(yield* Queue.take(probed));
      expect(seen).toEqual([
        'route-0.example',
        'route-1.example',
        'route-2.example',
        'route-3.example',
        'route-4.example',
      ]);
      const opened = yield* Queue.take(openings);
      yield* Queue.take(opened.followed);
      expect(routing.active.value?.address).toBe('http://route-4.example');
      yield* Scope.close(scope, Exit.void);
    }),
);
