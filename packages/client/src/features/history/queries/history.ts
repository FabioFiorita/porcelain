import { COMMITS_PER_PAGE } from '@porcelain/contracts/shared';
import { Effect, Option, Stream } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import { fileTimelineWindow, historyWindow } from '../rules/history.ts';
import type { ListFileCommitsResponse } from '@porcelain/contracts/changes';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import {
  worktreePull,
  worktreeRead,
} from '../../../shared/api/worktree-read.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';

type Continuation = { readonly after: readonly string[]; readonly tip: string };
type FileTimelineSelection = {
  connection: RuntimeConnection;
  scope: WorktreeScope;
  path: string;
};

export const historyPlace = Atom.family(
  (
    _selection: { connection: RuntimeConnection; scope: WorktreeScope } & (
      | { kind: 'commits' }
      | { kind: 'file'; path: string }
      | { kind: 'commit'; oid: string; parent: number }
    ),
  ) =>
    Atom.make<{
      loaded: number;
      selected: string | undefined;
      scrollOffset: number;
      graphScrollOffset: number;
      resetId: number;
    }>({
      loaded: 0,
      selected: undefined,
      scrollOffset: 0,
      graphScrollOffset: 0,
      resetId: 0,
    }).pipe(Atom.keepAlive),
);

export const readHistory = Atom.family(
  ({
    connection,
    scope,
  }: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
  }) =>
    worktreePull(
      connection,
      scope,
      ['history'],
      (get) =>
        historyPages(
          get,
          historyPlace({ connection, scope, kind: 'commits' }),
          (previous: Continuation | undefined) =>
            Effect.gen(function* () {
              const client = yield* porcelainClient(connection);
              const page = yield* client.request((api) =>
                api.changes.listCommits({
                  params: { worktreeId: scope.worktreeId },
                  query: { after: previous?.after, tip: previous?.tip },
                }),
              );
              yield* currentAnswerEffect(connection);
              return page;
            }),
          (page) =>
            page.nextAfter && page.tip
              ? { after: page.nextAfter, tip: page.tip }
              : undefined,
        ),
      clientRuntime(connection),
    ),
);

export const readCommit = Atom.family(
  ({
    connection,
    scope,
    oid,
    parent = 1,
  }: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
    oid: string;
    parent?: number;
  }) =>
    worktreeRead(
      connection,
      scope,
      ['commit', oid, parent],
      Effect.gen(function* () {
        const client = yield* porcelainClient(connection);
        const answer = yield* client.request((api) =>
          api.changes.readCommitFiles({
            params: { worktreeId: scope.worktreeId, oid },
            query: parent === 1 ? {} : { parent },
          }),
        );
        yield* currentAnswerEffect(
          connection,
          answer.commit.oid === oid &&
            (answer.comparison.kind === 'empty-tree' ||
              answer.comparison.parentNumber === parent),
        );
        return answer;
      }),
      clientRuntime(connection),
    ),
);

export const readFileTimeline = Atom.family(
  ({ connection, scope, path }: FileTimelineSelection) =>
    worktreePull(
      connection,
      scope,
      ['history', 'file', path],
      (get) =>
        historyPages(
          get,
          historyPlace({ connection, scope, kind: 'file', path }),
          (after: ListFileCommitsResponse['nextAfter']) =>
            Effect.gen(function* () {
              const client = yield* porcelainClient(connection);
              const page = yield* client.request((api) =>
                api.changes.listFileCommits({
                  params: { worktreeId: scope.worktreeId },
                  query: { path, limit: COMMITS_PER_PAGE, after },
                }),
              );
              yield* currentAnswerEffect(connection);
              return page;
            }),
          (page) => page.nextAfter,
        ),
      clientRuntime(connection),
    ),
);

function historyPages<
  Page extends {
    readonly commits: readonly unknown[];
    readonly restarted: boolean;
  },
  Cursor,
  E,
  R,
>(
  get: Atom.AtomContext,
  place: ReturnType<typeof historyPlace>,
  read: (cursor: Cursor | undefined) => Effect.Effect<Page, E, R>,
  continuation: (page: Page) => Cursor | undefined,
) {
  const restore = get.once(place).loaded;
  let loaded = 0;
  return Stream.paginate(undefined, (after: Cursor | undefined) =>
    Effect.gen(function* () {
      const pages: Page[] = [];
      let count = loaded;
      let next = after;
      let restarted = false;
      do {
        const page = yield* read(next);
        if (page.restarted) {
          count = 0;
          restarted = true;
        }
        count += page.commits.length;
        pages.push(page);
        next = continuation(page);
      } while (
        after === undefined &&
        count < restore &&
        next !== undefined &&
        !restarted
      );
      loaded = count;
      const current = get.once(place);
      get.set(place, {
        ...current,
        loaded,
        ...(restarted
          ? {
              selected: undefined,
              scrollOffset: 0,
              graphScrollOffset: 0,
              resetId: current.resetId + 1,
            }
          : {}),
      });
      return [
        pages,
        next === undefined ? Option.none() : Option.some(next),
      ] as const;
    }),
  );
}

export const readFileTimelineWindow = Atom.family(
  (selection: Parameters<typeof readFileTimeline>[0]) =>
    Atom.map(readFileTimeline(selection), (result) =>
      AsyncResult.map(result, (value) => fileTimelineWindow(value.items)),
    ).pipe(Atom.setIdleTTL(0)),
);

export const readHistoryWindow = Atom.family(
  (selection: Parameters<typeof readHistory>[0]) =>
    Atom.map(readHistory(selection), (result) =>
      AsyncResult.map(result, (value) => historyWindow(value.items)),
    ).pipe(Atom.setIdleTTL(0)),
);
