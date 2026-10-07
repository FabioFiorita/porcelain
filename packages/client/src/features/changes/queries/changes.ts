import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { worktreeRead } from '../../../shared/api/worktree-read.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';

type Selection = { connection: RuntimeConnection; scope: WorktreeScope };

export const readChangesSnapshot = Effect.fn('Changes.readSnapshot')(
  function* ({ connection, scope }: Selection) {
    const client = yield* porcelainClient(connection);
    const answer = yield* client.request((api) =>
      api.changes.readChanges({ params: { worktreeId: scope.worktreeId } }),
    );
    yield* currentAnswerEffect(
      connection,
      answer.environmentId === connection.environmentId &&
        answer.worktreeId === scope.worktreeId,
    );
    return answer;
  },
);

export const readChanges = Atom.family((selection: Selection) =>
  worktreeRead(
    selection.connection,
    selection.scope,
    ['changes'],
    readChangesSnapshot(selection),
    clientRuntime(selection.connection),
  ),
);

export const readGitStatusSnapshot = Effect.fn('Changes.readGitStatusSnapshot')(
  function* ({ connection, scope }: Selection) {
    const client = yield* porcelainClient(connection);
    const answer = yield* client.request((api) =>
      api.changes.readGitStatus({ params: { worktreeId: scope.worktreeId } }),
    );
    yield* currentAnswerEffect(
      connection,
      answer.environmentId === connection.environmentId &&
        answer.worktreeId === scope.worktreeId,
    );
    return answer;
  },
);

export const readGitStatus = Atom.family((selection: Selection) =>
  worktreeRead(
    selection.connection,
    selection.scope,
    ['git-status'],
    readGitStatusSnapshot(selection),
    clientRuntime(selection.connection),
  ),
);
