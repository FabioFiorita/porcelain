import { WorktreeChangedError } from '@porcelain/kernel/errors';
import { ConnectionError } from './connection-error.ts';
import { Effect } from 'effect';
import type { WorktreeConnection } from './connection.ts';

function changedContext() {
  return new ConnectionError({
    message:
      'The connected context changed. Reopen Porcelain to continue safely.',
  });
}

export function currentAnswerEffect(
  connection: Pick<WorktreeConnection, 'isClosed'>,
  matches = true,
): Effect.Effect<void, ConnectionError> {
  return Effect.suspend(() =>
    connection.isClosed() ? Effect.interrupt : currentContextEffect(matches),
  );
}

export function currentContextEffect(
  matches = true,
): Effect.Effect<void, ConnectionError> {
  return matches ? Effect.void : Effect.fail(changedContext());
}

export function isStaleChangeObservation(
  error: unknown,
): error is WorktreeChangedError {
  return error instanceof WorktreeChangedError;
}
