import { WorktreeChangedError } from '@porcelain/kernel/errors';
import { ConnectionError } from './connection-error.ts';
import { Effect } from 'effect';

function changedContext() {
  return new ConnectionError({
    message:
      'The connected context changed. Reopen Porcelain to continue safely.',
  });
}

export function currentAnswerEffect(
  signal: AbortSignal,
  matches = true,
): Effect.Effect<void, ConnectionError> {
  if (signal.aborted) return Effect.interrupt;
  return matches ? Effect.void : Effect.fail(changedContext());
}

export function assertCurrentAnswer(signal: AbortSignal, matches = true): void {
  signal.throwIfAborted();
  if (!matches) throw changedContext();
}

export function isStaleChangeObservation(
  error: unknown,
): error is WorktreeChangedError {
  return error instanceof WorktreeChangedError;
}
