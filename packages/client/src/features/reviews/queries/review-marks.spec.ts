import { scopedClientFixture as fixture } from '../../../../spec/kit/client-fixture.ts';
import { expect, it } from '@effect/vitest';
import { Effect, Fiber, Stream } from 'effect';
import { AtomRegistry, AsyncResult, Reactivity } from 'effect/reactivity';
import { queryKeys } from '@porcelain/client/transport';
import { readReviewMarks, reviewCommands } from '@porcelain/client/reviews';

const reviewId = '22222222-2222-4222-8222-222222222222';
const layerId = '11111111-1111-4111-8111-111111111111';
const fingerprint = 'b'.repeat(64);
const confirmed = {
  files: [],
  decisions: [{ layerId, fingerprint, reviewedAt: '2026-10-06T00:00:00.000Z' }],
};
const empty = { files: [], decisions: [] };

it.effect(
  'a late read cannot overwrite failed refresh state after a saved decision, and reconnect recovers its durable mark',
  () =>
    Effect.gen(function* () {
      const started = Promise.withResolvers<void>();
      const delivered = Promise.withResolvers<void>();
      const oldRead = Promise.withResolvers<Response>();
      let mode: 'old' | 'failed' | 'recovered' = 'old';
      let marked = false;
      const requests: string[] = [];
      const subject = yield* fixture((path, init) => {
        if (path === `/api/reviews/${reviewId}`)
          return Promise.resolve(
            Response.json({ review: null, revisions: [], revision: null }),
          );
        expect(path).toBe(`/api/reviews/${reviewId}/marks`);
        requests.push(init?.method ?? 'GET');
        if (init?.method === 'PUT') {
          marked = true;
          mode = 'failed';
          return Promise.resolve(Response.json({ updated: true }));
        }
        if (mode === 'old') {
          started.resolve();
          return oldRead.promise.then((response) => {
            delivered.resolve();
            return response;
          });
        }
        return Promise.resolve(
          mode === 'failed'
            ? Response.json({ message: 'Refresh unavailable' }, { status: 503 })
            : Response.json(marked ? confirmed : empty),
        );
      });
      const { input, state } = yield* mountedMarks(subject);
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          oldRead.resolve(Response.json(empty));
        }),
      );
      yield* Effect.promise(() => started.promise);
      const failure = yield* Effect.forkChild(
        AtomRegistry.toStream(subject.registry, state).pipe(
          Stream.filter(AsyncResult.isFailure),
          Stream.take(1),
          Stream.runDrain,
        ),
        { startImmediately: true },
      );
      const command = reviewCommands(input).mark;
      subject.registry.set(command, {
        kind: 'decision',
        revision: 2,
        layerId,
        fingerprint,
      });
      expect(
        yield* AtomRegistry.getResult(subject.registry, command, {
          suspendOnWaiting: true,
        }),
      ).toEqual({ updated: true });
      yield* Fiber.join(failure);
      oldRead.resolve(Response.json(empty));
      yield* Effect.promise(() => delivered.promise);
      yield* Effect.yieldNow;
      expect(AsyncResult.isFailure(subject.registry.get(state))).toBe(true);
      mode = 'recovered';
      expect(yield* reconnectedMarks(subject, state)).toEqual(confirmed);
      expect(requests).toEqual(['GET', 'PUT', 'GET', 'GET']);
    }),
);

it.effect(
  'unmarks only the selected durable decision and rechecks marks after reconnect',
  () =>
    Effect.gen(function* () {
      let marked = true;
      const writes: unknown[] = [];
      const subject = yield* fixture(async (path, init) => {
        if (path === `/api/reviews/${reviewId}`)
          return Response.json({ review: null, revisions: [], revision: null });
        if (init?.method === 'POST') {
          expect(path).toBe(`/api/reviews/${reviewId}/marks/removal`);
          const body: unknown = await new Response(init.body).json();
          writes.push(body);
          marked = false;
          return Response.json({ updated: true });
        }
        expect(path).toBe(`/api/reviews/${reviewId}/marks`);
        return Response.json(marked ? confirmed : empty);
      });
      const { input, state } = yield* mountedMarks(subject);
      expect(yield* AtomRegistry.getResult(subject.registry, state)).toEqual(
        confirmed,
      );
      const command = reviewCommands(input).unmark;
      subject.registry.set(command, { kind: 'decision', layerId, fingerprint });
      expect(
        yield* AtomRegistry.getResult(subject.registry, command, {
          suspendOnWaiting: true,
        }),
      ).toEqual({ updated: true });
      expect(
        yield* AtomRegistry.getResult(subject.registry, state, {
          suspendOnWaiting: true,
        }),
      ).toEqual(empty);
      marked = true;
      expect(yield* reconnectedMarks(subject, state)).toEqual(confirmed);
      expect(writes).toEqual([{ kind: 'decision', layerId, fingerprint }]);
    }),
);

const mountedMarks = Effect.fn(function* (
  subject: Effect.Success<ReturnType<typeof fixture>>,
) {
  const input = { connection: subject.connection, reviewId };
  const state = readReviewMarks(input);
  const unmount = subject.registry.mount(state);
  yield* Effect.addFinalizer(() => Effect.sync(unmount));
  return { input, state };
});

const reconnectedMarks = Effect.fn(function* (
  subject: Effect.Success<ReturnType<typeof fixture>>,
  state: ReturnType<typeof readReviewMarks>,
) {
  subject.connection.runtime.runSync(
    Reactivity.invalidate([queryKeys.environment('environment')]),
  );
  return yield* AtomRegistry.getResult(subject.registry, state, {
    suspendOnWaiting: true,
  });
});
