import { expect, it } from '@effect/vitest';
import { Layer, Effect, Option } from 'effect';
import { AtomRegistry, AsyncResult } from 'effect/reactivity';
import {
  createWorktreeConnection,
  type Transport,
} from '@porcelain/client/transport';
import { readHistory, readHistoryWindow } from './history.ts';

const scope = {
  projectId: 'project',
  worktreeId: '00000000000000000000000000000000',
};
const tip = 'a'.repeat(40);
const frontier = 'b'.repeat(40);
const root = 'c'.repeat(40);
function commit(oid: string, subject: string) {
  return {
    oid,
    subject,
    parentOids: [],
    author: { name: 'Author', timestamp: '2026-10-06T00:00:00.000Z' },
    subjectTruncated: false,
    body: null,
    bodyTruncated: false,
    refs: [],
  };
}
const firstPage = {
  snapshot: { tipOid: tip, head: { kind: 'attached', ref: 'refs/heads/main' } },
  commits: [commit(tip, 'Newest')],
  nextAfter: [frontier, root],
  tip,
  boundary: null,
  restarted: false,
};
function fixture(transport: Transport) {
  return Effect.acquireRelease(
    Effect.sync(() => ({
      ...createWorktreeConnection(
        {
          environmentId: 'environment',
          transport,
          timeoutMs: 10_000,
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
  'a failed later page retains confirmed commits and an explicit retry uses the same tip and frontier',
  () =>
    Effect.gen(function* () {
      const paths: string[] = [];
      const subject = yield* fixture((path) => {
        paths.push(path);
        return Promise.resolve(
          paths.length === 2
            ? Response.json(
                { message: 'Could not inspect Git' },
                { status: 500 },
              )
            : Response.json(
                paths.length === 1
                  ? firstPage
                  : {
                      ...firstPage,
                      commits: [commit(frontier, 'Older')],
                      nextAfter: null,
                    },
              ),
        );
      });
      const history = readHistory({ connection: subject.connection, scope });
      const stop = subject.registry.mount(history);
      yield* Effect.addFinalizer(() => Effect.sync(stop));
      yield* AtomRegistry.getResult(subject.registry, history);
      subject.registry.set(history, undefined);
      const failure = yield* Effect.exit(
        AtomRegistry.getResult(subject.registry, history, {
          suspendOnWaiting: true,
        }),
      );
      expect(failure._tag).toBe('Failure');
      const confirmed = Option.getOrThrow(
        AsyncResult.value(
          subject.registry.get(
            readHistoryWindow({ connection: subject.connection, scope }),
          ),
        ),
      );
      expect(confirmed.commits.map((entry) => entry.subject)).toEqual([
        'Newest',
      ]);
      subject.registry.set(history, undefined);
      yield* AtomRegistry.getResult(subject.registry, history, {
        suspendOnWaiting: true,
      });
      expect(
        (yield* AtomRegistry.getResult(
          subject.registry,
          readHistoryWindow({ connection: subject.connection, scope }),
        )).commits.map((entry) => entry.subject),
      ).toEqual(['Newest', 'Older']);
      expect(paths).toEqual([
        `/api/worktrees/${scope.worktreeId}/commits`,
        `/api/worktrees/${scope.worktreeId}/commits?after=${frontier}%2C${root}&tip=${tip}`,
        `/api/worktrees/${scope.worktreeId}/commits?after=${frontier}%2C${root}&tip=${tip}`,
      ]);
    }),
);

it.effect(
  'a restarted cursor replaces earlier visible pages and ends without another HTTP read',
  () =>
    Effect.gen(function* () {
      let requests = 0;
      const subject = yield* fixture(() =>
        Promise.resolve(
          Response.json(
            ++requests === 1
              ? firstPage
              : {
                  ...firstPage,
                  commits: [commit(root, 'Replacement history')],
                  nextAfter: null,
                  tip: root,
                  restarted: true,
                  snapshot: {
                    tipOid: root,
                    head: { kind: 'attached', ref: 'refs/heads/replacement' },
                  },
                },
          ),
        ),
      );
      const history = readHistory({ connection: subject.connection, scope });
      const stop = subject.registry.mount(history);
      yield* Effect.addFinalizer(() => Effect.sync(stop));
      yield* AtomRegistry.getResult(subject.registry, history);
      subject.registry.set(history, undefined);
      yield* AtomRegistry.getResult(subject.registry, history, {
        suspendOnWaiting: true,
      });
      expect(
        yield* AtomRegistry.getResult(
          subject.registry,
          readHistoryWindow({ connection: subject.connection, scope }),
        ),
      ).toMatchObject({
        snapshot: { tipOid: root },
        restarted: true,
        nextAfter: null,
      });
      expect(
        (yield* AtomRegistry.getResult(
          subject.registry,
          readHistoryWindow({ connection: subject.connection, scope }),
        )).commits.map((entry) => entry.subject),
      ).toEqual(['Replacement history']);
      subject.registry.set(history, undefined);
      const ended = yield* AtomRegistry.getResult(subject.registry, history, {
        suspendOnWaiting: true,
      });
      expect(ended.done).toBe(true);
      expect(
        (yield* AtomRegistry.getResult(
          subject.registry,
          readHistoryWindow({ connection: subject.connection, scope }),
        )).commits.map((entry) => entry.subject),
      ).toEqual(['Replacement history']);
      expect(requests).toBe(2);
    }),
);

it.effect(
  'refresh starts at the current tip with a fresh page stream instead of reusing an old frontier',
  () =>
    Effect.gen(function* () {
      const paths: string[] = [];
      const started = Promise.withResolvers<void>();
      const held = Promise.withResolvers<Response>();
      const subject = yield* fixture((path) => {
        paths.push(path);
        if (paths.length === 1)
          return Promise.resolve(Response.json(firstPage));
        started.resolve();
        return held.promise;
      });
      const history = readHistory({ connection: subject.connection, scope });
      const stop = subject.registry.mount(history);
      yield* Effect.addFinalizer(() => Effect.sync(stop));
      yield* AtomRegistry.getResult(subject.registry, history);
      subject.registry.refresh(history);
      yield* Effect.promise(() => started.promise);
      held.resolve(
        Response.json({
          ...firstPage,
          commits: [commit(root, 'New tip')],
          nextAfter: null,
          tip: root,
        }),
      );
      yield* AtomRegistry.getResult(subject.registry, history, {
        suspendOnWaiting: true,
      });
      expect(
        (yield* AtomRegistry.getResult(
          subject.registry,
          readHistoryWindow({ connection: subject.connection, scope }),
        )).commits.map((entry) => entry.subject),
      ).toEqual(['New tip']);
      expect(paths).toEqual([
        `/api/worktrees/${scope.worktreeId}/commits`,
        `/api/worktrees/${scope.worktreeId}/commits`,
      ]);
    }),
);

it.effect(
  'an unborn worktree is a confirmed empty history and reaches the end without an invented commit',
  () =>
    Effect.gen(function* () {
      const subject = yield* fixture(() =>
        Promise.resolve(
          Response.json({
            snapshot: {
              tipOid: null,
              head: { kind: 'unborn', ref: 'refs/heads/main' },
            },
            commits: [],
            nextAfter: null,
            tip: null,
            boundary: null,
            restarted: false,
          }),
        ),
      );
      const history = readHistory({ connection: subject.connection, scope });
      const stop = subject.registry.mount(history);
      yield* Effect.addFinalizer(() => Effect.sync(stop));
      yield* AtomRegistry.getResult(subject.registry, history);
      expect(
        yield* AtomRegistry.getResult(
          subject.registry,
          readHistoryWindow({ connection: subject.connection, scope }),
        ),
      ).toMatchObject({
        commits: [],
        nextAfter: null,
        snapshot: { tipOid: undefined, head: { kind: 'unborn' } },
      });
      subject.registry.set(history, undefined);
      const end = yield* AtomRegistry.getResult(subject.registry, history, {
        suspendOnWaiting: true,
      });
      expect(end.done).toBe(true);
      expect(
        (yield* AtomRegistry.getResult(
          subject.registry,
          readHistoryWindow({ connection: subject.connection, scope }),
        )).commits,
      ).toEqual([]);
    }),
);
