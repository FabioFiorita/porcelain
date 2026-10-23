import { describe, expect, it } from '@effect/vitest';
import {
  Cause,
  Context,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Layer,
  Queue,
} from 'effect';
import type { LiveChannel } from '../../ports/live-channel.ts';
import { RecordingLiveChannel } from '../../../spec/fakes/recording-live-channel.ts';
import { Logger } from '../../ports/logger.ts';
import { LiveConnections } from './live-connections.ts';

const subject = Effect.fn(function* (capacity: number = 2) {
  const failures: unknown[] = [];
  const context = yield* Layer.build(
    LiveConnections.layer(capacity).pipe(
      Layer.provide(
        Layer.succeed(Logger, {
          failure: (report) => failures.push(report.error),
        }),
      ),
    ),
  );
  return { live: Context.get(context, LiveConnections), failures };
});

const channel = Effect.fn(function* (
  onSend: LiveChannel['send'] = () => Effect.void,
) {
  return new RecordingLiveChannel({
    messages: yield* Queue.unbounded<Parameters<LiveChannel['send']>[0]>(),
    controls: yield* Queue.unbounded<'ping' | 'terminated'>(),
    onSend,
  });
});

const targets = (projectId: string, worktreeId: string) => ({
  projects: [projectId],
  worktrees: [{ projectId, worktreeId }],
});

describe('LiveConnections', () => {
  it.effect(
    'sends ready and confirms every replacement including an empty one',
    () =>
      Effect.gen(function* () {
        const { live } = yield* subject();
        const peer = yield* channel();
        const client = yield* live.connect(peer);
        expect(yield* peer.next()).toEqual({ type: 'ready' });
        yield* client.follow(targets('a', 'one'));
        yield* client.follow({ projects: [], worktrees: [] });
        expect([yield* peer.next(), yield* peer.next()]).toEqual([
          { type: 'subscribed' },
          { type: 'subscribed' },
        ]);
      }),
  );

  it.effect(
    'routes project and worktree notices to their followers and sends global notices to both',
    () =>
      Effect.gen(function* () {
        const { live } = yield* subject();
        const first = yield* channel();
        const second = yield* channel();
        const a = yield* live.connect(first);
        const b = yield* live.connect(second);
        yield* first.next();
        yield* second.next();
        yield* a.follow(targets('a', 'one'));
        yield* b.follow(targets('b', 'two'));
        yield* first.next();
        yield* second.next();
        yield* live.toProject('a', {
          type: 'project',
          projectId: 'a',
          change: 'preferences',
        });
        yield* live.heartbeat();
        expect([yield* first.next(), yield* first.next()]).toEqual([
          { type: 'project', projectId: 'a', change: 'preferences' },
          { type: 'heartbeat' },
        ]);
        expect(yield* second.next()).toEqual({ type: 'heartbeat' });
        yield* live.toWorktree('one', (projectId) => ({
          type: 'worktree',
          projectId,
          worktreeId: 'one',
          change: 'git',
        }));
        yield* live.heartbeat();
        expect([yield* first.next(), yield* first.next()]).toEqual([
          {
            type: 'worktree',
            projectId: 'a',
            worktreeId: 'one',
            change: 'git',
          },
          { type: 'heartbeat' },
        ]);
        expect(yield* second.next()).toEqual({ type: 'heartbeat' });
      }),
  );

  it.effect(
    'delivers a project-or-worktree notice once when the same client follows both',
    () =>
      Effect.gen(function* () {
        const { live } = yield* subject();
        const peer = yield* channel();
        const client = yield* live.connect(peer);
        yield* peer.next();
        yield* client.follow(targets('a', 'one'));
        yield* peer.next();
        yield* live.toProjectOrWorktree('a', 'one', { type: 'inventory' });
        yield* live.heartbeat();
        expect([yield* peer.next(), yield* peer.next()]).toEqual([
          { type: 'inventory' },
          { type: 'heartbeat' },
        ]);
      }),
  );

  it.effect(
    'stops following old targets after replacement while retaining global delivery',
    () =>
      Effect.gen(function* () {
        const { live } = yield* subject();
        const peer = yield* channel();
        const client = yield* live.connect(peer);
        yield* peer.next();
        yield* client.follow(targets('a', 'one'));
        yield* peer.next();
        yield* client.follow({ projects: [], worktrees: [] });
        yield* peer.next();
        yield* live.toWorktree('one', (projectId) => ({
          type: 'worktree',
          projectId,
          worktreeId: 'one',
          change: 'git',
        }));
        yield* live.heartbeat();
        expect(yield* peer.next()).toEqual({ type: 'heartbeat' });
        expect(peer.notices()).toEqual([
          { type: 'ready' },
          { type: 'subscribed' },
          { type: 'subscribed' },
          { type: 'heartbeat' },
        ]);
      }),
  );

  it.effect(
    'pings responders and retires a client that misses its next pong',
    () =>
      Effect.gen(function* () {
        const { live } = yield* subject();
        const peer = yield* channel();
        const client = yield* live.connect(peer);
        yield* peer.next();
        yield* live.ping();
        expect(yield* peer.nextControl()).toBe('ping');
        yield* client.answered();
        yield* live.ping();
        expect(yield* peer.nextControl()).toBe('ping');
        yield* live.ping();
        expect(yield* peer.nextControl()).toBe('terminated');
        yield* client.follow(targets('a', 'one'));
        yield* live.heartbeat();
        expect(peer.notices()).toEqual([{ type: 'ready' }]);
      }),
  );

  it.effect(
    'retires a pong-responsive stalled client while writers and two healthy clients keep going and resubscribe',
    () =>
      Effect.gen(function* () {
        const { live, failures } = yield* subject(1);
        const sending = yield* Deferred.make<void>();
        const aborted = yield* Deferred.make<void>();
        const cleanup = Promise.withResolvers<void>();
        const blocked = yield* channel((notice) =>
          notice.type === 'inventory'
            ? Deferred.succeed(sending, undefined).pipe(
                Effect.andThen(Effect.never),
                Effect.onInterrupt(() =>
                  Deferred.succeed(aborted, undefined).pipe(
                    Effect.andThen(Effect.promise(() => cleanup.promise)),
                  ),
                ),
              )
            : Effect.void,
        );
        const client = yield* live.connect(blocked);
        yield* blocked.next();
        const healthy = [yield* channel(), yield* channel()];
        const responders = [];
        for (const peer of healthy) {
          responders.push(yield* live.connect(peer));
          yield* peer.next();
        }
        try {
          yield* live.toEveryone({ type: 'inventory' });
          yield* Deferred.await(sending);
          expect(yield* Effect.forEach(healthy, (peer) => peer.next())).toEqual(
            [{ type: 'inventory' }, { type: 'inventory' }],
          );
          const progress: boolean[] = [];
          const deliveries = [];
          for (let index = 0; index < 4; index += 1) {
            yield* client.answered();
            for (const responder of responders) yield* responder.answered();
            yield* live.ping();
            let published = false;
            const publisher = yield* Effect.forkChild(
              live.heartbeat().pipe(
                Effect.tap(() =>
                  Effect.sync(() => {
                    published = true;
                  }),
                ),
              ),
              { startImmediately: true },
            );
            progress.push(published);
            if (!published) break;
            yield* Fiber.join(publisher);
            deliveries.push(
              ...(yield* Effect.forEach(healthy, (peer) => peer.next())),
            );
          }
          expect(progress).toEqual([true, true, true, true]);
          expect(deliveries).toEqual([
            { type: 'heartbeat' },
            { type: 'heartbeat' },
            { type: 'heartbeat' },
            { type: 'heartbeat' },
            { type: 'heartbeat' },
            { type: 'heartbeat' },
            { type: 'heartbeat' },
            { type: 'heartbeat' },
          ]);
          expect(yield* blocked.nextControl()).toBe('ping');
          expect(yield* blocked.nextControl()).toBe('ping');
          expect(yield* blocked.nextControl()).toBe('terminated');
          yield* Deferred.await(aborted);
          const fresh = yield* channel();
          const recovered = yield* live.connect(fresh);
          expect(yield* fresh.next()).toEqual({ type: 'ready' });
          yield* recovered.follow(targets('a', 'one'));
          expect(yield* fresh.next()).toEqual({ type: 'subscribed' });
          yield* live.toProject('a', {
            type: 'project',
            projectId: 'a',
            change: 'preferences',
          });
          expect(yield* fresh.next()).toEqual({
            type: 'project',
            projectId: 'a',
            change: 'preferences',
          });
          yield* client.follow(targets('a', 'one'));
          expect(blocked.notices()).toEqual([{ type: 'ready' }]);
          expect(failures).toEqual([]);
        } finally {
          cleanup.resolve();
        }
        yield* client.close();
        yield* live.close();
        yield* live.close();
      }),
  );

  it.effect(
    'unfollowed traffic cannot overflow a stalled client and replacing targets filters queued notices',
    () =>
      Effect.gen(function* () {
        const { live, failures } = yield* subject(1);
        const started = yield* Deferred.make<void>();
        const gate = yield* Deferred.make<void>();
        const peer = yield* channel((notice) =>
          notice.type === 'inventory'
            ? Deferred.succeed(started, undefined).pipe(
                Effect.andThen(Deferred.await(gate)),
              )
            : Effect.void,
        );
        const client = yield* live.connect(peer);
        yield* peer.next();
        yield* client.follow(targets('a', 'one'));
        yield* peer.next();
        yield* live.toEveryone({ type: 'inventory' });
        yield* Deferred.await(started);
        const progress: boolean[] = [];
        for (let index = 0; index < 4; index += 1) {
          let published = false;
          const publisher = yield* Effect.forkChild(
            live.toProject('b', { type: 'inventory' }).pipe(
              Effect.andThen(
                live.toWorktree('two', () => ({ type: 'inventory' })),
              ),
              Effect.andThen(
                live.toProjectOrWorktree('b', 'two', { type: 'inventory' }),
              ),
              Effect.tap(() =>
                Effect.sync(() => {
                  published = true;
                }),
              ),
            ),
            { startImmediately: true },
          );
          progress.push(published);
          if (!published) break;
          yield* Fiber.join(publisher);
        }
        expect(progress).toEqual([true, true, true, true]);
        yield* live.toProject('a', {
          type: 'project',
          projectId: 'a',
          change: 'preferences',
        });
        yield* client.follow({ projects: [], worktrees: [] });
        expect(yield* peer.next()).toEqual({ type: 'subscribed' });
        yield* Deferred.succeed(gate, undefined);
        expect(yield* peer.next()).toEqual({ type: 'inventory' });
        yield* Effect.yieldNow;
        yield* live.ping();
        expect(yield* peer.nextControl()).toBe('ping');
        yield* live.heartbeat();
        expect(yield* peer.next()).toEqual({ type: 'heartbeat' });
        expect(peer.notices()).toEqual([
          { type: 'ready' },
          { type: 'subscribed' },
          { type: 'subscribed' },
          { type: 'inventory' },
          { type: 'heartbeat' },
        ]);
        yield* client.close();
        expect(failures).toEqual([]);
      }),
  );

  it.effect(
    'waits for send cleanup during shutdown and refuses new clients afterwards',
    () =>
      Effect.gen(function* () {
        const { live, failures } = yield* subject();
        const started = yield* Deferred.make<void>();
        const aborted = yield* Deferred.make<void>();
        const cleanup = Promise.withResolvers<void>();
        const peer = yield* channel((notice) =>
          notice.type === 'inventory'
            ? Deferred.succeed(started, undefined).pipe(
                Effect.andThen(Effect.never),
                Effect.onInterrupt(() =>
                  Deferred.succeed(aborted, undefined).pipe(
                    Effect.andThen(Effect.promise(() => cleanup.promise)),
                  ),
                ),
              )
            : Effect.void,
        );
        yield* live.connect(peer);
        yield* peer.next();
        yield* live.toEveryone({ type: 'inventory' });
        yield* Deferred.await(started);
        let closed = false;
        const closing = yield* Effect.forkChild(
          live.close().pipe(
            Effect.tap(() =>
              Effect.sync(() => {
                closed = true;
              }),
            ),
          ),
        );
        yield* Deferred.await(aborted);
        expect(closed).toBe(false);
        cleanup.resolve();
        yield* Fiber.join(closing);
        expect(closed).toBe(true);
        const refused = yield* Effect.exit(live.connect(yield* channel()));
        expect(
          Exit.isFailure(refused) && Cause.squash(refused.cause),
        ).toMatchObject({ name: 'ApplicationClosedError' });
        expect(peer.notices()).toEqual([{ type: 'ready' }]);
        expect(failures).toEqual([]);
      }),
  );

  it.effect(
    'releases a failed ready handshake before admitting a healthy client',
    () =>
      Effect.gen(function* () {
        const { live } = yield* subject(1);
        const failure = new Error('ready failed');
        const broken = yield* channel(() => Effect.die(failure));
        const exit = yield* Effect.exit(live.connect(broken));
        expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBe(failure);
        const peer = yield* channel();
        yield* live.connect(peer);
        expect(yield* peer.next()).toEqual({ type: 'ready' });
        yield* live.heartbeat();
        expect(yield* peer.next()).toEqual({ type: 'heartbeat' });
      }),
  );

  it.effect(
    'reports a failed send once and retires its subscription so it cannot block healthy clients',
    () =>
      Effect.gen(function* () {
        const { live, failures } = yield* subject(1);
        const failure = new Error('send failed');
        const broken = yield* channel((notice) =>
          notice.type === 'inventory' ? Effect.die(failure) : Effect.void,
        );
        yield* live.connect(broken);
        yield* broken.next();
        yield* live.toEveryone({ type: 'inventory' });
        expect(yield* broken.nextControl()).toBe('terminated');
        const peer = yield* channel();
        yield* live.connect(peer);
        yield* peer.next();
        yield* live.heartbeat();
        expect(yield* peer.next()).toEqual({ type: 'heartbeat' });
        expect(failures).toEqual([failure]);
        expect(broken.notices()).toEqual([{ type: 'ready' }]);
      }),
  );
});
