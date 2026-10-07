import { Effect } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import type {
  ReadChangeDiffsRequest,
  ReadBranchDiffsRequest,
} from '@porcelain/contracts/changes';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { worktreeRead } from '../../../shared/api/worktree-read.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { selectionKey, type DiffContent } from '../rules/changes.ts';

type Selection = { connection: RuntimeConnection; scope: WorktreeScope };

export const readChangeDiffs = Atom.family(
  ({
    connection,
    scope,
    input,
  }: Selection & { input: ReadChangeDiffsRequest }) =>
    worktreeRead(
      connection,
      scope,
      ['change-diffs', input],
      Effect.gen(function* () {
        const api = yield* porcelainClient(connection);
        const answer = yield* requestEffect(
          api.changes.readChangeDiffs({
            params: { worktreeId: scope.worktreeId },
            payload: input,
          }),
          connection.request,
        );
        yield* currentAnswerEffect(
          connection.request().signal,
          answer.environmentId === connection.environmentId &&
            answer.worktreeId === scope.worktreeId &&
            answer.statusToken === input.expectedStatusToken,
        );
        return answer;
      }),
      clientRuntime(connection),
      input.expectedFiles.map((file) => file.path),
    ),
);

export const readBranchDiffs = Atom.family(
  ({
    connection,
    scope,
    input,
  }: Selection & { input: ReadBranchDiffsRequest }) =>
    worktreeRead(
      connection,
      scope,
      ['branch-diffs', input],
      Effect.gen(function* () {
        const api = yield* porcelainClient(connection);
        return yield* requestEffect(
          api.changes.readBranchDiffs({
            params: { worktreeId: scope.worktreeId },
            payload: input,
          }),
          connection.request,
        );
      }),
      clientRuntime(connection),
    ),
);

export const readCommitDiffs = Atom.family(
  ({
    connection,
    scope,
    oid,
    parent,
    paths,
  }: Selection & {
    oid: string;
    parent: number;
    paths: readonly (readonly string[])[];
  }) =>
    worktreeRead(
      connection,
      scope,
      ['commit-diffs', oid, parent, paths],
      Effect.gen(function* () {
        const api = yield* porcelainClient(connection);
        const answer = yield* requestEffect(
          api.changes.readCommitDiffs({
            params: { worktreeId: scope.worktreeId, oid },
            payload: {
              ...(parent === 1 ? {} : { parent }),
              paths: paths.map((entry) => [...entry]),
            },
          }),
          connection.request,
        );
        yield* currentAnswerEffect(
          connection.request().signal,
          answer.commitOid === oid,
        );
        return answer;
      }),
      clientRuntime(connection),
    ),
);

export const readChangeLines = Atom.family(
  ({
    connection,
    scope,
    path,
    from,
    to,
  }: Selection & { path: string; from: number; to: number }) =>
    worktreeRead(
      connection,
      scope,
      ['step-lines', path, from, to],
      Effect.gen(function* () {
        const api = yield* porcelainClient(connection);
        const answer = yield* requestEffect(
          api.changes.readChangeLines({
            params: { worktreeId: scope.worktreeId },
            query: { path, from, to, at: 'worktree' },
          }),
          connection.request,
        );
        yield* currentAnswerEffect(
          connection.request().signal,
          answer.environmentId === connection.environmentId &&
            answer.worktreeId === scope.worktreeId,
        );
        return answer;
      }),
      clientRuntime(connection),
      [path],
    ),
);

type DiffRead =
  | ReturnType<typeof readChangeDiffs>
  | ReturnType<typeof readBranchDiffs>
  | ReturnType<typeof readCommitDiffs>;
type DiffReply = Atom.Success<DiffRead>;
type DiffFailure = Atom.Failure<DiffRead>;
type DiffAtom = Atom.Atom<AsyncResult.AsyncResult<DiffReply, DiffFailure>>;

function diffEntries(answer: DiffReply): ReadonlyMap<string, DiffContent> {
  return new Map(
    answer.diffs.map((diff) => [
      'selection' in diff
        ? selectionKey(diff.selection)
        : diff.paths.join('\0'),
      diff.content,
    ]),
  );
}

export const readDiffBatches = Atom.family((queries: readonly DiffAtom[]) =>
  Atom.readable(
    (get) => queries.map((query) => AsyncResult.map(get(query), diffEntries)),
    (refresh) => {
      for (const query of queries) refresh(query);
    },
  ),
);

export const readCompleteDiffWindow = Atom.family(
  (queries: readonly DiffAtom[]) =>
    Atom.make((get) =>
      Effect.map(
        Effect.forEach(
          queries,
          (query) =>
            Effect.map(
              get.result(query, { suspendOnWaiting: true }),
              diffEntries,
            ),
          { concurrency: 'unbounded' },
        ),
        (entries) => new Map(entries.flatMap((entry) => [...entry])),
      ),
    ).pipe(Atom.setIdleTTL(0)),
);
