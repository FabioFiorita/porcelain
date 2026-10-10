import { expect, it } from '@effect/vitest';
import { Layer, Effect, Fiber, Option, Stream } from 'effect';
import { AtomRegistry, AsyncResult, Reactivity } from 'effect/reactivity';
import {
  createWorktreeConnection,
  queryKeys,
  type Transport,
} from '@porcelain/client/transport';
import { readLayerMarks, toggleLayerMark } from '@porcelain/client/reviews';

const scope = { projectId: 'project', worktreeId: 'a'.repeat(32) };
const layerId = '11111111-1111-4111-8111-111111111111';
const fingerprint = 'b'.repeat(64);
const confirmed = {
  worktreeId: scope.worktreeId,
  marks: [
    {
      layerId,
      fingerprint,
      stale: false,
      reviewedAt: '2026-10-06T00:00:00.000Z',
    },
  ],
};
function fixture(transport: Transport) {
  return Effect.acquireRelease(
    Effect.sync(() => ({
      ...createWorktreeConnection(
        {
          environmentId: 'environment',
          timeoutMs: 10_000,
          transport,
        },
        undefined,
        Layer.empty,
      ),
      registry: AtomRegistry.make(),
    })),
    (subject) =>
      Effect.promise(async () => {
        subject.registry.dispose();
        await subject.close();
      }),
  );
}
it.effect(
  'a confirmed layer mark survives an older unfinished read and a failed refresh',
  () =>
    Effect.gen(function* () {
      const started = Promise.withResolvers<void>();
      const oldRead = Promise.withResolvers<Response>();
      const requests: { path: string; method: string; body: unknown }[] = [];
      const subject = yield* fixture((path, init) => {
        const body = init?.body;
        requests.push({
          path,
          method: init?.method ?? 'GET',
          body:
            body instanceof Uint8Array
              ? JSON.parse(new TextDecoder().decode(body))
              : null,
        });
        if (init?.method === 'PUT')
          return Promise.resolve(Response.json(confirmed));
        if (requests.length === 1) {
          started.resolve();
          return oldRead.promise;
        }
        return Promise.resolve(
          Response.json({ message: 'Refresh unavailable' }, { status: 503 }),
        );
      });
      const state = readLayerMarks({ connection: subject.connection, scope });
      const stop = subject.registry.mount(state);
      yield* Effect.addFinalizer(() => Effect.sync(stop));
      yield* Effect.promise(() => started.promise);
      const published = yield* Effect.forkChild(
        AtomRegistry.toStream(subject.registry, state).pipe(
          Stream.filter(
            (result) =>
              Option.getOrUndefined(AsyncResult.value(result))?.marks[0]
                ?.layerId === layerId,
          ),
          Stream.take(1),
          Stream.runHead,
        ),
        { startImmediately: true },
      );
      const command = toggleLayerMark({
        connection: subject.connection,
        scope,
      });
      subject.registry.set(command, { layerId, fingerprint, action: 'mark' });
      expect(
        yield* AtomRegistry.getResult(subject.registry, command, {
          suspendOnWaiting: true,
        }),
      ).toEqual(confirmed);
      yield* Fiber.join(published);
      oldRead.resolve(
        Response.json({ worktreeId: scope.worktreeId, marks: [] }),
      );
      const failure = yield* AtomRegistry.toStream(
        subject.registry,
        state,
      ).pipe(
        Stream.filter(AsyncResult.isFailure),
        Stream.take(1),
        Stream.runHead,
      );
      expect(
        Option.getOrThrow(AsyncResult.value(Option.getOrThrow(failure))),
      ).toEqual(confirmed);
      expect(requests).toEqual([
        {
          path: `/api/worktrees/${scope.worktreeId}/reviewed-layers`,
          method: 'GET',
          body: null,
        },
        {
          path: `/api/worktrees/${scope.worktreeId}/reviewed-layers`,
          method: 'PUT',
          body: { layerId, fingerprint, reviewed: true },
        },
        {
          path: `/api/worktrees/${scope.worktreeId}/reviewed-layers`,
          method: 'GET',
          body: null,
        },
      ]);
    }),
);
it.effect(
  'unmarking uses the selected layer, publishes the empty confirmed list and reconnect invalidation refreshes it',
  () =>
    Effect.gen(function* () {
      const paths: string[] = [];
      let marked = true;
      const subject = yield* fixture((path, init) => {
        paths.push(path);
        if (init?.method === 'DELETE') marked = false;
        return Promise.resolve(
          Response.json(
            marked ? confirmed : { worktreeId: scope.worktreeId, marks: [] },
          ),
        );
      });
      const state = readLayerMarks({ connection: subject.connection, scope });
      const stop = subject.registry.mount(state);
      yield* Effect.addFinalizer(() => Effect.sync(stop));
      expect(
        (yield* AtomRegistry.getResult(subject.registry, state)).marks[0]
          ?.layerId,
      ).toBe(layerId);
      const command = toggleLayerMark({
        connection: subject.connection,
        scope,
      });
      subject.registry.set(command, { layerId, fingerprint, action: 'unmark' });
      expect(
        (yield* AtomRegistry.getResult(subject.registry, command, {
          suspendOnWaiting: true,
        })).marks,
      ).toEqual([]);
      expect(
        (yield* AtomRegistry.getResult(subject.registry, state, {
          suspendOnWaiting: true,
        })).marks,
      ).toEqual([]);
      marked = true;
      const refreshed = yield* Effect.forkChild(
        AtomRegistry.toStream(subject.registry, state).pipe(
          Stream.filter(
            (result) =>
              Option.getOrUndefined(AsyncResult.value(result))?.marks[0]
                ?.layerId === layerId,
          ),
          Stream.take(1),
          Stream.runHead,
        ),
        { startImmediately: true },
      );
      subject.connection.runtime.runSync(
        Reactivity.invalidate([queryKeys.environment('environment')]),
      );
      expect(
        Option.getOrThrow(
          AsyncResult.value(Option.getOrThrow(yield* Fiber.join(refreshed))),
        ).marks[0]?.layerId,
      ).toBe(layerId);
      expect(paths[1]).toBe(
        `/api/worktrees/${scope.worktreeId}/reviewed-layers?layerId=${layerId}`,
      );
    }),
);
