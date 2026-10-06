import { porcelainClient } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { Atom } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { worktreeRead } from '../../../shared/api/worktree-read.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import { Effect } from 'effect';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import {
  FileTooLargeError,
  UnsupportedTextError,
} from '@porcelain/files/errors';

function unreadableFileReason(error: unknown) {
  if (error instanceof UnsupportedTextError)
    return 'This file is binary or uses an unsupported text encoding.';
  if (error instanceof FileTooLargeError)
    return 'This file is too large to display as text.';
  return null;
}

export const readTextFile = Atom.family(
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
      ['text', path],
      Effect.gen(function* () {
        const api = yield* porcelainClient(connection);
        return yield* requestEffect(
          api.files.readTextFile({
            params: { worktreeId: scope.worktreeId },
            query: { path },
          }),
        ).pipe(
          Effect.tap((answer) =>
            currentAnswerEffect(
              connection.request().signal,
              answer.worktreeId === scope.worktreeId && answer.path === path,
            ),
          ),
          Effect.catch((error) => {
            const reason = unreadableFileReason(error);
            return reason
              ? Effect.succeed({ kind: 'unreadable' as const, reason })
              : Effect.fail(error);
          }),
        );
      }),
      clientRuntime(connection),
      [path],
    ),
);
