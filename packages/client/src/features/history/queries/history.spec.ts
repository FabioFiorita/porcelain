import {
  scopedClientFixture as fixture,
  idleClientAtoms,
} from '../../../../spec/kit/client-fixture.ts';
import { expect, it } from '@effect/vitest';
import { Effect, HashMap, Option } from 'effect';
import { AtomRegistry, AsyncResult } from 'effect/reactivity';
import { ReadSubscriptions } from '../../../shared/api/read-subscriptions.ts';

import {
  readFileTimeline,
  readFileTimelineWindow,
  readHistory,
  readHistoryWindow,
  historyPlace,
  readCommit,
} from './history.ts';

import {
  scope,
  tip,
  frontier,
  root,
  commit,
  firstPage,
  restoredHistoryPage,
} from '../../../../spec/kit/history-pages.ts';
import { holdReturningRead } from '../../../../spec/kit/held-transport.ts';

it.effect(
  'returns retained commit metadata while revalidating its exact parent comparison',
  () =>
    Effect.gen(function* () {
      const answer = {
        commit: commit(tip, 'Confirmed'),
        comparison: { kind: 'parent', parentNumber: 2, baseOid: root },
        files: [],
      };
      const returning = holdReturningRead(answer);
      const subject = yield* fixture(returning.read);
      const query = readCommit({
        connection: subject.connection,
        scope,
        oid: tip,
        parent: 2,
      });
      let stop = subject.registry.mount(query);
      yield* Effect.addFinalizer(() => Effect.sync(() => stop()));
      yield* AtomRegistry.getResult(subject.registry, query);
      stop();
      yield* Effect.promise(() => idleClientAtoms(subject.registry));
      stop = subject.registry.mount(query);
      yield* Effect.promise(() => returning.started.promise);
      expect(subject.registry.get(query)).toMatchObject({
        _tag: 'Success',
        waiting: true,
      });
      expect(
        Option.getOrThrow(AsyncResult.value(subject.registry.get(query))),
      ).toMatchObject({
        commit: { oid: tip, subject: 'Confirmed' },
        comparison: answer.comparison,
        files: [],
      });
      returning.held.resolve(Response.json(answer));
      expect(
        yield* AtomRegistry.getResult(subject.registry, query, {
          suspendOnWaiting: true,
        }),
      ).toMatchObject({
        commit: { oid: tip, subject: 'Confirmed' },
        comparison: answer.comparison,
        files: [],
      });
      expect(returning.readCount()).toBe(2);
    }),
);

it.effect(
  'returns the complete retained History depth until every restored page is fresh',
  () =>
    Effect.gen(function* () {
      const started = Promise.withResolvers<void>();
      const held = Promise.withResolvers<Response>();
      let reads = 0;
      const subject = yield* fixture((path) => {
        const older = new URL(path, 'http://fixture').searchParams.has('after');
        reads++;
        if (reads === 4) {
          started.resolve();
          return held.promise;
        }
        return Promise.resolve(
          Response.json(restoredHistoryPage(older, reads >= 3)),
        );
      });
      const selection = { connection: subject.connection, scope };
      const history = readHistory(selection);
      const window = readHistoryWindow(selection);
      let stop = subject.registry.mount(window);
      yield* Effect.addFinalizer(() => Effect.sync(() => stop()));
      yield* AtomRegistry.getResult(subject.registry, window);
      subject.registry.set(history, undefined);
      yield* AtomRegistry.getResult(subject.registry, window, {
        suspendOnWaiting: true,
      });
      const place = historyPlace({ ...selection, kind: 'commits' });
      subject.registry.set(place, {
        ...subject.registry.get(place),
        selected: root,
        scrollOffset: 240,
        graphScrollOffset: 320,
      });
      stop();
      yield* Effect.promise(() => idleClientAtoms(subject.registry));
      expect(
        yield* Effect.promise(() =>
          subject.connection.runtime.runPromise(
            ReadSubscriptions.use((reads) =>
              Effect.map(reads.snapshot, HashMap.size),
            ),
          ),
        ),
      ).toBe(0);
      stop = subject.registry.mount(window);
      yield* Effect.promise(() => started.promise);
      const pending = subject.registry.get(window);
      expect(pending.waiting).toBe(true);
      expect(
        Option.getOrThrow(AsyncResult.value(pending)).commits.map(
          (entry) => entry.subject,
        ),
      ).toEqual(['Old newest', 'Old oldest']);
      expect(subject.registry.get(place)).toMatchObject({
        loaded: 2,
        selected: root,
        scrollOffset: 240,
        graphScrollOffset: 320,
        resetId: 0,
      });
      held.resolve(
        Response.json({
          ...firstPage,
          commits: [commit(root, 'Fresh oldest')],
          nextAfter: null,
        }),
      );
      expect(
        (yield* AtomRegistry.getResult(subject.registry, window, {
          suspendOnWaiting: true,
        })).commits.map((entry) => entry.subject),
      ).toEqual(['Fresh newest', 'Fresh oldest']);
      expect(reads).toBe(4);
    }),
);

it.effect(
  'a returning History restart replaces retained rows and resets its place once',
  () =>
    Effect.gen(function* () {
      const returning = holdReturningRead(firstPage);
      const subject = yield* fixture(returning.read);
      const selection = { connection: subject.connection, scope };
      const window = readHistoryWindow(selection);
      const place = historyPlace({ ...selection, kind: 'commits' });
      let stop = subject.registry.mount(window);
      yield* Effect.addFinalizer(() => Effect.sync(() => stop()));
      yield* AtomRegistry.getResult(subject.registry, window);
      subject.registry.set(place, {
        ...subject.registry.get(place),
        selected: tip,
        scrollOffset: 240,
        graphScrollOffset: 320,
      });
      stop();
      yield* Effect.promise(() => idleClientAtoms(subject.registry));
      stop = subject.registry.mount(window);
      yield* Effect.promise(() => returning.started.promise);
      expect(
        Option.getOrThrow(
          AsyncResult.value(subject.registry.get(window)),
        ).commits.map((entry) => entry.subject),
      ).toEqual(['Newest']);
      returning.held.resolve(
        Response.json({
          ...firstPage,
          commits: [commit(root, 'Replacement')],
          tip: root,
          nextAfter: null,
          restarted: true,
          snapshot: { ...firstPage.snapshot, tipOid: root },
        }),
      );
      expect(
        (yield* AtomRegistry.getResult(subject.registry, window, {
          suspendOnWaiting: true,
        })).commits.map((entry) => entry.subject),
      ).toEqual(['Replacement']);
      expect(subject.registry.get(place)).toMatchObject({
        loaded: 1,
        selected: undefined,
        scrollOffset: 0,
        graphScrollOffset: 0,
        resetId: 1,
      });
    }),
);

it.effect(
  'retrying a failed multi-page restoration rereads the whole retained depth',
  () =>
    Effect.gen(function* () {
      let reads = 0;
      const subject = yield* fixture((path) => {
        reads++;
        const older = new URL(path, 'http://fixture').searchParams.has('after');
        return Promise.resolve(
          reads === 4
            ? Response.json({ message: 'Unavailable' }, { status: 500 })
            : Response.json(restoredHistoryPage(older, reads >= 3)),
        );
      });
      const history = yield* mountedHistory(subject);
      subject.registry.set(history, undefined);
      yield* AtomRegistry.getResult(subject.registry, history, {
        suspendOnWaiting: true,
      });
      subject.registry.refresh(history);
      expect(
        (yield* Effect.exit(
          AtomRegistry.getResult(subject.registry, history, {
            suspendOnWaiting: true,
          }),
        ))._tag,
      ).toBe('Failure');
      subject.registry.set(history, undefined);
      yield* AtomRegistry.getResult(subject.registry, history, {
        suspendOnWaiting: true,
      });
      expect(yield* historySubjects(subject)).toEqual([
        'Fresh newest',
        'Fresh oldest',
      ]);
      expect(
        subject.registry.get(
          historyPlace({
            connection: subject.connection,
            scope,
            kind: 'commits',
          }),
        ).loaded,
      ).toBe(2);
      expect(reads).toBe(6);
    }),
);

it.effect(
  'a returning file timeline restores its loaded depth, selection and reading position while rereading fresh data',
  () =>
    Effect.gen(function* () {
      let reads = 0;
      const started = Promise.withResolvers<void>();
      const held = Promise.withResolvers<void>();
      const subject = yield* fixture(() => {
        reads++;
        const first = reads === 1 || reads === 3;
        const answer = Response.json({
          commits: [
            {
              commit: commit(
                first ? tip : root,
                reads >= 3
                  ? first
                    ? 'Fresh newest'
                    : 'Fresh oldest'
                  : first
                    ? 'Newest'
                    : 'Oldest',
              ),
              path: 'notes.md',
              previousPath: null,
              status: first ? 'modified' : 'added',
            },
          ],
          nextAfter: first ? { tip, offset: 1 } : null,
          tip,
          boundary: null,
          restarted: false,
        });
        if (reads === 4) {
          started.resolve();
          return held.promise.then(() => answer);
        }
        return Promise.resolve(answer);
      });
      const selection = {
        connection: subject.connection,
        scope,
        path: 'notes.md',
      };
      const timeline = readFileTimeline(selection);
      const window = readFileTimelineWindow(selection);
      const stop = subject.registry.mount(window);
      yield* AtomRegistry.getResult(subject.registry, timeline);
      subject.registry.set(timeline, undefined);
      yield* AtomRegistry.getResult(subject.registry, timeline, {
        suspendOnWaiting: true,
      });
      const place = historyPlace({ ...selection, kind: 'file' });
      subject.registry.set(place, {
        ...subject.registry.get(place),
        selected: root,
        scrollOffset: 240,
      });
      yield* AtomRegistry.getResult(subject.registry, window);
      stop();
      yield* Effect.promise(() => idleClientAtoms(subject.registry));
      const release = subject.registry.mount(window);
      yield* Effect.addFinalizer(() => Effect.sync(release));
      yield* Effect.promise(() => started.promise);
      expect(
        Option.getOrThrow(
          AsyncResult.value(subject.registry.get(window)),
        ).commits.map((entry) => entry.commit.subject),
      ).toEqual(['Newest', 'Oldest']);
      expect(subject.registry.get(window).waiting).toBe(true);
      held.resolve();
      yield* AtomRegistry.getResult(subject.registry, timeline, {
        suspendOnWaiting: true,
      });
      expect(yield* timelineSubjects(subject, window)).toEqual([
        'Fresh newest',
        'Fresh oldest',
      ]);
      expect(reads).toBe(4);
      expect(subject.registry.get(place)).toMatchObject({
        loaded: 2,
        selected: root,
        scrollOffset: 240,
      });
    }),
);

it.effect(
  'file timeline retries the exact failed cursor, retains rows, and replaces them after a restart',
  () =>
    Effect.gen(function* () {
      const requests: string[] = [];
      const newest = {
        commits: [
          {
            commit: commit(tip, 'Rename'),
            path: 'new.md',
            previousPath: 'old.md',
            status: 'renamed',
          },
        ],
        nextAfter: { tip, offset: 1 },
        tip,
        boundary: null,
        restarted: false,
      };
      const subject = yield* fixture((path) => {
        requests.push(path);
        return Promise.resolve(
          requests.length === 2
            ? Response.json({ message: 'Unavailable' }, { status: 500 })
            : Response.json(
                requests.length === 1
                  ? newest
                  : requests.length === 3
                    ? {
                        ...newest,
                        commits: [
                          {
                            commit: commit(frontier, 'Older'),
                            path: 'old.md',
                            previousPath: null,
                            status: 'modified',
                          },
                        ],
                        nextAfter: { tip, offset: 2 },
                      }
                    : {
                        ...newest,
                        commits: [
                          {
                            commit: commit(root, 'Replacement'),
                            path: 'new.md',
                            previousPath: null,
                            status: 'added',
                          },
                        ],
                        nextAfter: null,
                        tip: root,
                        restarted: true,
                      },
              ),
        );
      });
      const selection = {
        connection: subject.connection,
        scope,
        path: 'new.md',
      };
      const timeline = readFileTimeline(selection);
      const window = readFileTimelineWindow(selection);
      const stop = subject.registry.mount(timeline);
      yield* Effect.addFinalizer(() => Effect.sync(stop));
      yield* AtomRegistry.getResult(subject.registry, timeline);
      const place = historyPlace({ ...selection, kind: 'file' });
      subject.registry.set(place, {
        ...subject.registry.get(place),
        selected: tip,
        scrollOffset: 240,
        graphScrollOffset: 320,
      });
      subject.registry.set(timeline, undefined);
      expect(
        (yield* Effect.exit(
          AtomRegistry.getResult(subject.registry, timeline, {
            suspendOnWaiting: true,
          }),
        ))._tag,
      ).toBe('Failure');
      expect(
        Option.getOrThrow(
          AsyncResult.value(subject.registry.get(window)),
        ).commits.map((entry) => entry.commit.subject),
      ).toEqual(['Rename']);
      subject.registry.set(timeline, undefined);
      yield* AtomRegistry.getResult(subject.registry, timeline, {
        suspendOnWaiting: true,
      });
      expect(yield* timelineSubjects(subject, window)).toEqual([
        'Rename',
        'Older',
      ]);
      expect(requests[1]).toBe(requests[2]);
      expect(
        new URL(requests[1]!, 'http://fixture').searchParams.get('after'),
      ).toBe(JSON.stringify({ tip, offset: 1 }));
      subject.registry.set(timeline, undefined);
      yield* AtomRegistry.getResult(subject.registry, timeline, {
        suspendOnWaiting: true,
      });
      expect(
        yield* AtomRegistry.getResult(subject.registry, window),
      ).toMatchObject({
        commits: [{ commit: { subject: 'Replacement' } }],
        nextAfter: null,
        tip: root,
        restarted: true,
      });
      expect(subject.registry.get(place)).toMatchObject({
        selected: undefined,
        scrollOffset: 0,
        graphScrollOffset: 0,
        resetId: 1,
        loaded: 1,
      });
      subject.registry.set(timeline, undefined);
      expect(
        (yield* AtomRegistry.getResult(subject.registry, timeline, {
          suspendOnWaiting: true,
        })).done,
      ).toBe(true);
      expect(requests).toHaveLength(4);
    }),
);

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
      const history = yield* mountedHistory(subject);
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
      expect(yield* historySubjects(subject)).toEqual(['Newest', 'Older']);
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
      const history = yield* mountedHistory(subject);
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
      expect(yield* historySubjects(subject)).toEqual(['Replacement history']);
      subject.registry.set(history, undefined);
      const ended = yield* AtomRegistry.getResult(subject.registry, history, {
        suspendOnWaiting: true,
      });
      expect(ended.done).toBe(true);
      expect(yield* historySubjects(subject)).toEqual(['Replacement history']);
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
      const history = yield* mountedHistory(subject);
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
      expect(yield* historySubjects(subject)).toEqual(['New tip']);
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
      const history = yield* mountedHistory(subject);
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

const mountedHistory = Effect.fn(function* (
  subject: Effect.Success<ReturnType<typeof fixture>>,
) {
  const history = readHistory({ connection: subject.connection, scope });
  const stop = subject.registry.mount(history);
  yield* Effect.addFinalizer(() => Effect.sync(stop));
  yield* AtomRegistry.getResult(subject.registry, history);
  return history;
});
function historySubjects(subject: Effect.Success<ReturnType<typeof fixture>>) {
  return Effect.map(
    AtomRegistry.getResult(
      subject.registry,
      readHistoryWindow({ connection: subject.connection, scope }),
    ),
    (answer) => answer.commits.map((entry) => entry.subject),
  );
}

function timelineSubjects(
  subject: Effect.Success<ReturnType<typeof fixture>>,
  window: ReturnType<typeof readFileTimelineWindow>,
) {
  return Effect.map(AtomRegistry.getResult(subject.registry, window), (value) =>
    value.commits.map((entry) => entry.commit.subject),
  );
}
