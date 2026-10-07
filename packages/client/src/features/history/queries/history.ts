import { COMMITS_PER_PAGE } from '@porcelain/contracts/shared';
import { Effect, Option, Stream } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import { historyWindow } from '../rules/history.ts';
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
      Stream.paginate(undefined, (previous: Continuation | undefined) =>
        Effect.gen(function* () {
          const client = yield* porcelainClient(connection);
          const page = yield* client.request((api) =>
            api.changes.listCommits({
              params: { worktreeId: scope.worktreeId },
              query: { after: previous?.after, tip: previous?.tip },
            }),
          );
          yield* currentAnswerEffect(connection.request().signal);
          return [
            [page],
            page.nextAfter && page.tip
              ? Option.some({ after: page.nextAfter, tip: page.tip })
              : Option.none(),
          ] as const;
        }),
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
          connection.request().signal,
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
  ({
    connection,
    scope,
    path,
  }: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
    path: string;
  }) =>
    worktreeRead(
      connection,
      scope,
      ['history', 'file', path],
      Effect.gen(function* () {
        const client = yield* porcelainClient(connection);
        return yield* client.request((api) =>
          api.changes.listFileCommits({
            params: { worktreeId: scope.worktreeId },
            query: { path, limit: COMMITS_PER_PAGE },
          }),
        );
      }),
      clientRuntime(connection),
    ),
);

export const readHistoryWindow = Atom.family(
  (selection: Parameters<typeof readHistory>[0]) =>
    Atom.map(readHistory(selection), (result) =>
      AsyncResult.map(result, (value) => historyWindow(value.items)),
    ).pipe(Atom.setIdleTTL(0)),
);
