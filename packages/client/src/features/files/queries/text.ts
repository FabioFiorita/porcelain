import { Atom } from 'effect/reactivity';
import type { WorktreeSelection } from '../../../shared/api/connection.ts';
import { clientWorktreeRead } from '../../../shared/api/worktree-read.ts';
import { Effect } from 'effect';
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
  ({ connection, scope, path }: WorktreeSelection & { path: string }) =>
    clientWorktreeRead(
      { connection, scope },
      ['text', path],
      (api) =>
        api.files
          .readTextFile({
            params: { worktreeId: scope.worktreeId },
            query: { path },
          })
          .pipe(
            Effect.catch((error) => {
              const reason = unreadableFileReason(error);
              return reason
                ? Effect.succeed({ kind: 'unreadable' as const, reason })
                : Effect.fail(error);
            }),
          ),
      (answer) =>
        'reason' in answer ||
        (answer.worktreeId === scope.worktreeId && answer.path === path),
      [path],
    ),
);
