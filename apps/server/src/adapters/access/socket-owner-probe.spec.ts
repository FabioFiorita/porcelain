import { expect, it } from '@effect/vitest';
import { NodeServices } from '@effect/platform-node';
import { Deferred, Effect, Exit, Fiber } from 'effect';
import { TestClock } from 'effect/testing';
import { openOwnerProbePeer } from '@porcelain/server/kit/http';
import { SocketOwnerProbe } from './socket-owner-probe.ts';

it.effect(
  'distinguishes a running owner, absent socket, rejected status and malformed body',
  () =>
    Effect.gen(function* () {
      const test = yield* openOwnerProbePeer();
      const probe = new SocketOwnerProbe();
      const status = {
        address: 'http://127.0.0.1:4737',
        dataDirectory: '/data',
        pid: 123,
      };
      test.state.body = JSON.stringify(status);
      expect(
        yield* probe.probe({ socketPath: test.socketPath, timeoutMs: 1000 }),
      ).toEqual({ kind: 'running', status });
      expect(
        yield* probe.probe({
          socketPath: test.socketPath + '.missing',
          timeoutMs: 1000,
        }),
      ).toEqual({ kind: 'absent' });
      test.state.status = 503;
      expect(
        yield* probe.probe({ socketPath: test.socketPath, timeoutMs: 1000 }),
      ).toEqual({
        kind: 'unreadable',
        reason: 'the owner socket answered 503',
      });
      test.state.status = 200;
      test.state.body = 'invalid JSON';
      expect(
        yield* probe.probe({ socketPath: test.socketPath, timeoutMs: 1000 }),
      ).toEqual({
        kind: 'unreadable',
        reason: 'the owner socket answered something unrecognizable',
      });
      test.state.body = '{}';
      expect(
        yield* probe.probe({ socketPath: test.socketPath, timeoutMs: 1000 }),
      ).toEqual({
        kind: 'unreadable',
        reason: 'the owner socket answered something unrecognizable',
      });
    }).pipe(Effect.provide(NodeServices.layer), TestClock.withLive),
);

it.effect('times out an owner socket that never answers', () =>
  Effect.gen(function* () {
    const test = yield* openOwnerProbePeer();
    test.state.pending = true;
    expect(
      yield* new SocketOwnerProbe().probe({
        socketPath: test.socketPath,
        timeoutMs: 20,
      }),
    ).toEqual({
      kind: 'unreadable',
      reason: 'the owner socket did not answer in time',
    });
  }).pipe(Effect.provide(NodeServices.layer), TestClock.withLive),
);

it.effect(
  'interrupts a pending probe instead of returning an unreadable answer',
  () =>
    Effect.gen(function* () {
      const test = yield* openOwnerProbePeer();
      test.state.pending = true;
      const fiber = yield* Effect.forkChild(
        new SocketOwnerProbe().probe({
          socketPath: test.socketPath,
          timeoutMs: 1000,
        }),
      );
      yield* Deferred.await(test.received);
      yield* Fiber.interrupt(fiber);
      yield* Deferred.await(test.disconnected);
      expect(Exit.hasInterrupts(yield* Fiber.await(fiber))).toBe(true);
    }).pipe(Effect.provide(NodeServices.layer), TestClock.withLive),
);
